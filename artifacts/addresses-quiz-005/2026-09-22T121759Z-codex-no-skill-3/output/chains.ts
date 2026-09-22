type Address = `0x${string}`;

export type ChainConfig = {
  chainId: number;
  lendingPool: Address;
  usdc: Address;
};

export const chains = {
  mainnet: {
    chainId: 1,
    lendingPool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", // Aave address book AaveV3Ethereum.POOL: https://github.com/aave-dao/aave-address-book/blob/main/src/AaveV3Ethereum.sol
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // Aave address book AaveV3EthereumAssets.USDC_UNDERLYING: https://github.com/aave-dao/aave-address-book/blob/main/src/AaveV3Ethereum.sol
  },
  arbitrum: {
    chainId: 42161,
    lendingPool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Aave address book AaveV3Arbitrum.POOL: https://github.com/aave-dao/aave-address-book/blob/main/src/AaveV3Arbitrum.sol
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Aave address book AaveV3ArbitrumAssets.USDCn_UNDERLYING: https://github.com/aave-dao/aave-address-book/blob/main/src/AaveV3Arbitrum.sol
  },
  optimism: {
    chainId: 10,
    lendingPool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Aave address book AaveV3Optimism.POOL: https://github.com/aave-dao/aave-address-book/blob/main/src/AaveV3Optimism.sol
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // Aave address book AaveV3OptimismAssets.USDCn_UNDERLYING: https://github.com/aave-dao/aave-address-book/blob/main/src/AaveV3Optimism.sol
  },
  base: {
    chainId: 8453,
    lendingPool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", // Aave address book AaveV3Base.POOL: https://github.com/aave-dao/aave-address-book/blob/main/src/AaveV3Base.sol
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Aave address book AaveV3BaseAssets.USDC_UNDERLYING: https://github.com/aave-dao/aave-address-book/blob/main/src/AaveV3Base.sol
  },
} satisfies Record<string, ChainConfig>;

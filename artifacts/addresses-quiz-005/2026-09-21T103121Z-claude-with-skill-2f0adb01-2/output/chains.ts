// Aave V3 Pool + native USDC per chain, for Pool.supply(usdc, amount, onBehalfOf, 0).
// All addresses verified onchain 2026-09-21: PoolAddressesProvider.getPool() == pool,
// USDC.symbol() == "USDC", and Pool.getReserveData(usdc) returns a live aToken.

export type ChainConfig = {
  chainId: number;
  aavePool: `0x${string}`;
  usdc: `0x${string}`;
};

export const chains = {
  mainnet: {
    chainId: 1,
    // Aave V3 Ethereum Pool — Aave docs (deployed-contracts), == PoolAddressesProvider 0x2f39…4E9e .getPool()
    aavePool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    // Circle native USDC — Circle docs / Etherscan; listed Aave reserve (aEthUSDC 0x98C2…6F5c)
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
  arbitrum: {
    chainId: 42161,
    // Aave V3 Arbitrum Pool — Aave docs (deployed-contracts), == PoolAddressesProvider 0xa976…3CDb .getPool()
    aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    // Circle native USDC (not bridged USDC.e) — Circle docs / Arbiscan; Aave reserve (aArbUSDCn 0x724d…C637)
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  },
  optimism: {
    chainId: 10,
    // Aave V3 Optimism Pool — Aave docs (deployed-contracts), == PoolAddressesProvider 0xa976…3CDb .getPool()
    aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    // Circle native USDC (not bridged USDC.e) — Circle docs / Optimistic Etherscan; Aave reserve (aOptUSDCn 0x38d6…22e5)
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  },
  base: {
    chainId: 8453,
    // Aave V3 Base Pool — Aave docs (deployed-contracts), == PoolAddressesProvider 0xe20f…d64D .getPool()
    aavePool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    // Circle native USDC (not bridged USDbC) — Circle docs / Basescan; Aave reserve (aBasUSDC 0x4e65…c0AB)
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
} as const satisfies Record<string, ChainConfig>;

export type ChainName = keyof typeof chains;

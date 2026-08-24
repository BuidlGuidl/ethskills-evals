/**
 * Chain configuration for the "park idle USDC in Aave" feature.
 *
 * Each entry names the Aave V3 lending pool the app calls `supply()` on and the
 * USDC token it supplies. Every address below was verified on its own chain on
 * 2026-08-18 (see per-address comments); re-check them against the Aave address
 * book before moving real funds, since deployments do get superseded.
 *
 * Verification performed per chain:
 *   - pool.ADDRESSES_PROVIDER().getPool() round-trips back to the pool address,
 *     and the provider's getMarketId() names the expected market
 *   - pool.getReserveAToken(USDC) returns the market's aUSDC, whose
 *     UNDERLYING_ASSET_ADDRESS() is the USDC address configured here
 *   - the USDC reserve is active, not frozen and not paused
 *
 * USDC is the issuer-native token on every chain here, never the bridged
 * variant (Arbitrum USDC.e, Optimism USDC.e, Base USDbC). Those are separate
 * Aave reserves with separate liquidity — supplying to the wrong one succeeds
 * silently and parks the funds in the wrong market.
 */

type Address = `0x${string}`;

export interface ChainConfig {
  /** EIP-155 chain id. */
  chainId: number;
  /** Aave V3 `Pool` — the contract `supply()` is called on. */
  aaveV3Pool: Address;
  /** USDC supplied into the pool (issuer-native, 6 decimals). */
  usdc: Address;
  /** aToken minted by the supply, for balance display. */
  aUsdc: Address;
}

export const CHAINS = {
  mainnet: {
    chainId: 1,
    // Aave V3 Ethereum Pool — aave-address-book AaveV3Ethereum.POOL; confirmed on
    // chain 1: provider 0x2f39d2…4E9e getMarketId() == "Aave Ethereum Market".
    aaveV3Pool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    // Circle-issued USDC on Ethereum (circle.com/usdc contract list); symbol()
    // "USDC", decimals() 6, and the pool's USDC reserve resolves to it.
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    // pool.getReserveAToken(USDC) on chain 1 → symbol() "aEthUSDC".
    aUsdc: "0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c",
  },

  arbitrum: {
    chainId: 42161,
    // Aave V3 Arbitrum Pool — aave-address-book AaveV3Arbitrum.POOL; confirmed on
    // chain 42161: provider 0xa976…3CDb getMarketId() == "Arbitrum Aave Market".
    aaveV3Pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    // Native USDC on Arbitrum (Circle contract list) — NOT bridged USDC.e
    // 0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8, which is a different reserve.
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    // pool.getReserveAToken(USDC) on chain 42161 → symbol() "aArbUSDCn" (native).
    aUsdc: "0x724dc807b04555b71ed48a6896b6F41593b8C637",
  },

  optimism: {
    chainId: 10,
    // Aave V3 Optimism Pool — aave-address-book AaveV3Optimism.POOL; confirmed on
    // chain 10: provider 0xa976…3CDb getMarketId() == "Optimism Aave Market".
    // Same address as Arbitrum's pool, but verified separately on chain 10.
    aaveV3Pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    // Native USDC on Optimism (Circle contract list) — NOT bridged USDC.e
    // 0x7F5c764cBc14f9669B88837ca1490cCa17c31607, which is a different reserve.
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    // pool.getReserveAToken(USDC) on chain 10 → symbol() "aOptUSDCn" (native).
    aUsdc: "0x38d693cE1dF5AaDF7bC62595A37D667aD57922e5",
  },

  base: {
    chainId: 8453,
    // Aave V3 Base Pool — aave-address-book AaveV3Base.POOL; confirmed on chain
    // 8453: provider 0xe20f…d64D getMarketId() == "Aave V3 BASE Market". Base has
    // its own pool address, unlike the Arbitrum/Optimism pair above.
    aaveV3Pool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    // Native USDC on Base (Circle contract list) — NOT bridged USDbC
    // 0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA, which is a different reserve.
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    // pool.getReserveAToken(USDC) on chain 8453 → symbol() "aBasUSDC".
    aUsdc: "0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB",
  },
} as const satisfies Record<string, ChainConfig>;

export type SupportedChain = keyof typeof CHAINS;

export const USDC_DECIMALS = 6;

/** Chains keyed by chain id, for resolving the connected wallet's network. */
export const CHAINS_BY_ID = Object.fromEntries(
  Object.values(CHAINS).map((c) => [c.chainId, c]),
) as Record<number, ChainConfig>;

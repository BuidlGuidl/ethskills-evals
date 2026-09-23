// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Canonical (native, Circle-issued) USDC per chain, so a deploy cannot be pointed at a
///         bridged lookalike by a typo. Override with the USDC env var for anything not listed.
library UsdcAddresses {
    error UnknownChain(uint256 chainId);

    function forChain(uint256 chainId) internal pure returns (address) {
        if (chainId == 1) return 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48; // Ethereum
        if (chainId == 8453) return 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913; // Base
        if (chainId == 84532) return 0x036CbD53842c5426634e7929541eC2318f3dCF7e; // Base Sepolia
        if (chainId == 10) return 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85; // Optimism
        if (chainId == 42161) return 0xaf88d065e77c8cC2239327C5EDb3A432268e5831; // Arbitrum One
        if (chainId == 137) return 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359; // Polygon
        if (chainId == 11155111) return 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238; // Sepolia
        revert UnknownChain(chainId);
    }
}

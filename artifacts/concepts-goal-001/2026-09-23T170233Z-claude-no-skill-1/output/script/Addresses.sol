// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Canonical (Circle-issued, native) USDC per chain.
/// @dev Always cross-check against https://developers.circle.com/stablecoins/usdc-contract-addresses
/// before a mainnet deploy. Bridged "USDbC"-style tokens are deliberately not
/// listed: they are a different asset with different redemption guarantees.
library Addresses {
    uint256 internal constant BASE = 8453;
    uint256 internal constant BASE_SEPOLIA = 84532;
    uint256 internal constant ANVIL = 31337;

    function usdc(uint256 chainId) internal pure returns (address) {
        if (chainId == BASE) return 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
        if (chainId == BASE_SEPOLIA) return 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
        return address(0);
    }

    function name(uint256 chainId) internal pure returns (string memory) {
        if (chainId == BASE) return "base";
        if (chainId == BASE_SEPOLIA) return "base-sepolia";
        if (chainId == ANVIL) return "anvil";
        return "unknown";
    }

    function isProduction(uint256 chainId) internal pure returns (bool) {
        return chainId == BASE;
    }
}

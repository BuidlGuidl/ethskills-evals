// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

interface IPriceOracle {
    function wethPriceInUsdc() external view returns (uint256 priceE8, uint256 updatedAt);
}


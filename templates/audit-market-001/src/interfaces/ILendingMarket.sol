// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface ILendingMarket {
    function requireHealthy(address user) external view;
}

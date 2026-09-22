// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPositionValueOracle} from "../../src/interfaces/IPositionValueOracle.sol";
import {MockNonfungiblePositionManager} from "./MockNonfungiblePositionManager.sol";

contract MockPositionValueOracle is IPositionValueOracle {
    MockNonfungiblePositionManager public immutable positionManager;

    constructor(MockNonfungiblePositionManager positionManager_) {
        positionManager = positionManager_;
    }

    function positionValueInAsset(uint256 tokenId) external view returns (uint256) {
        return positionManager.positionValue(tokenId);
    }

    function tokenValueInAsset(address, uint256 amount) external pure returns (uint256) {
        return amount;
    }
}


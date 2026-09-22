// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {SaveVaultFactory} from "../src/SaveVaultFactory.sol";

contract DeployFactory {
    function run() external returns (SaveVaultFactory factory) {
        factory = new SaveVaultFactory();
    }
}


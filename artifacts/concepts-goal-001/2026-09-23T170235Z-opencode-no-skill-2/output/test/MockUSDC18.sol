// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {MockUSDC} from "./MockUSDC.sol";

contract MockUSDC18 is MockUSDC {
    constructor() MockUSDC(18) {}
}

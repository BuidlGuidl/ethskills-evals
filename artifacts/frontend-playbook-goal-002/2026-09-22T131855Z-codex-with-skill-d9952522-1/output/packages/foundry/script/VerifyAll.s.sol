// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";

contract VerifyAll is Script {
    function run() external pure {
        revert("Verification is disabled for this local-only project");
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import "../contracts/USDCTipJar.sol";

contract DeployUSDCTipJar is ScaffoldETHDeploy {
    address public constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external ScaffoldEthDeployerRunner {
        USDCTipJar tipJar = new USDCTipJar(deployer, BASE_USDC);
        deployments.push(Deployment("USDCTipJar", address(tipJar)));
    }
}

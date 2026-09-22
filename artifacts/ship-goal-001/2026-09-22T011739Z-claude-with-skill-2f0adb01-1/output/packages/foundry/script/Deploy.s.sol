//SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { DeployToolshed } from "./DeployToolshed.s.sol";

/**
 * @notice Main deployment script.
 *
 * Example: yarn deploy # runs this script (without `--file` flag)
 */
contract DeployScript is ScaffoldETHDeploy {
    function run() external {
        DeployToolshed deployToolshed = new DeployToolshed();
        deployToolshed.run();
    }
}

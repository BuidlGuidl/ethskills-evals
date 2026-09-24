// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {MemberRegistry} from "../src/MemberRegistry.sol";
import {Toolshed} from "../src/Toolshed.sol";
import {MockUSDC} from "../src/test/MockUSDC.sol";

/// @notice Deploys the registry + lending contract and wires them together.
///
/// Env:
///   USDC_ADDRESS  - the USDC token to settle in. Leave unset only on a local chain: the script then
///                   deploys MockUSDC so you have something to test with.
///   STEWARD       - association steward (roster admin + dispute arbiter). Defaults to the deployer.
contract Deploy is Script {
    function run() external returns (MemberRegistry registry, Toolshed shed, address usdc) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address steward = vm.envOr("STEWARD", deployer);
        usdc = vm.envOr("USDC_ADDRESS", address(0));

        vm.startBroadcast(pk);

        if (usdc == address(0)) {
            require(block.chainid == 31337, "set USDC_ADDRESS outside of anvil");
            usdc = address(new MockUSDC());
            console2.log("Deployed MockUSDC (local only):", usdc);
        }

        registry = new MemberRegistry(deployer); // deployer stays steward until wiring is done
        shed = new Toolshed(IERC20(usdc), registry);
        registry.setLedger(address(shed), true);
        if (steward != deployer) registry.transferSteward(steward);

        vm.stopBroadcast();

        console2.log("chainId       :", block.chainid);
        console2.log("USDC          :", usdc);
        console2.log("MemberRegistry:", address(registry));
        console2.log("Toolshed      :", address(shed));
        console2.log("Steward       :", steward);

        _writeDeployment(address(registry), address(shed), usdc, steward);
    }

    /// @dev Drops a JSON file the frontend and the seed script read, at deployments/<chainId>.json.
    function _writeDeployment(address registry, address shed, address usdc, address steward) internal {
        string memory json = string.concat(
            '{\n  "chainId": ',
            vm.toString(block.chainid),
            ',\n  "memberRegistry": "',
            vm.toString(registry),
            '",\n  "toolshed": "',
            vm.toString(shed),
            '",\n  "usdc": "',
            vm.toString(usdc),
            '",\n  "steward": "',
            vm.toString(steward),
            '"\n}\n'
        );
        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeFile(path, json);
        console2.log("Wrote", path);
    }
}

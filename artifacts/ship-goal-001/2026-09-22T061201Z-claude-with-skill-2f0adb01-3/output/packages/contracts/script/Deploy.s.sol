// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Toolshed} from "../src/Toolshed.sol";
import {MockUSDC} from "../test/mocks/MockUSDC.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @notice Deploys Toolshed.
 *
 * Env:
 *   ESCROW_TOKEN  address of USDC on the target chain. Omit on a local chain (31337) and a
 *                 MockUSDC is deployed instead and pre-funded to the steward.
 *   STEWARD       association admin (a Safe in production). Defaults to the deployer.
 *   MAX_DEPOSIT   ceiling on a tool's deposit, in USDC units. Defaults to 2000 USDC.
 *
 *   forge script script/Deploy.s.sol --rpc-url base --broadcast --verify
 */
contract Deploy is Script {
    function run() external returns (Toolshed shed, address escrowToken) {
        uint256 pk = vm.envOr("PRIVATE_KEY", uint256(0));
        address deployer = pk == 0 ? msg.sender : vm.addr(pk);

        address steward = vm.envOr("STEWARD", deployer);
        uint96 maxDeposit = uint96(vm.envOr("MAX_DEPOSIT", uint256(2_000e6)));
        escrowToken = vm.envOr("ESCROW_TOKEN", address(0));

        if (pk == 0) vm.startBroadcast();
        else vm.startBroadcast(pk);

        if (escrowToken == address(0)) {
            require(block.chainid == 31337, "set ESCROW_TOKEN (USDC) for a live chain");
            MockUSDC mock = new MockUSDC();
            mock.mint(deployer, 1_000_000e6);
            escrowToken = address(mock);
            console.log("MockUSDC (local only):", escrowToken);
        }

        shed = new Toolshed(IERC20(escrowToken), steward, maxDeposit);
        vm.stopBroadcast();

        console.log("chainId:      ", block.chainid);
        console.log("Toolshed:     ", address(shed));
        console.log("escrow token: ", escrowToken);
        console.log("steward:      ", steward);
        console.log("maxDeposit:   ", maxDeposit);
        console.log("");
        console.log("Put these in packages/app/.env.local:");
        console.log(string.concat("NEXT_PUBLIC_TOOLSHED_ADDRESS=", vm.toString(address(shed))));
        console.log(string.concat("NEXT_PUBLIC_USDC_ADDRESS=", vm.toString(escrowToken)));
        console.log(string.concat("NEXT_PUBLIC_CHAIN_ID=", vm.toString(block.chainid)));
    }
}

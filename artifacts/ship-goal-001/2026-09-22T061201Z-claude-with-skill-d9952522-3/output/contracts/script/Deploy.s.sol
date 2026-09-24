// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ToolshedEscrow} from "../src/ToolshedEscrow.sol";

/// @notice Deploys ToolshedEscrow. See README "Deploying" for the exact commands.
///
/// Env:
///   USDC_ADDRESS   the USDC token for the target chain (defaults below per chain id)
///   ARBITER        the association's multisig — required, no default, this address can split
///                  the deposit of any escalated loan
contract Deploy is Script {
    /// @dev Circle's official USDC addresses.
    ///      https://developers.circle.com/stablecoins/usdc-contract-addresses
    address internal constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address internal constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external returns (ToolshedEscrow escrow) {
        address usdc = vm.envOr("USDC_ADDRESS", _defaultUsdc());
        address arbiter = vm.envAddress("ARBITER");

        require(usdc.code.length > 0, "USDC_ADDRESS has no code on this chain");
        require(arbiter != address(0), "ARBITER not set");

        console2.log("chain id  ", block.chainid);
        console2.log("usdc      ", usdc);
        console2.log("arbiter   ", arbiter);

        vm.startBroadcast();
        escrow = new ToolshedEscrow(IERC20(usdc), arbiter);
        vm.stopBroadcast();

        console2.log("escrow    ", address(escrow));
        console2.log("eip712    ");
        console2.logBytes32(escrow.domainSeparator());
    }

    function _defaultUsdc() internal view returns (address) {
        if (block.chainid == 8453) return USDC_BASE;
        if (block.chainid == 84532) return USDC_BASE_SEPOLIA;
        revert("set USDC_ADDRESS for this chain");
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {AeroUsdcWethVault} from "../src/AeroUsdcWethVault.sol";
import {BaseAddresses as B} from "./BaseAddresses.sol";

/// @notice forge script script/Deploy.s.sol --rpc-url base --broadcast --account <keystore>
///         env: OWNER (multisig), KEEPER, DEPOSIT_CAP (USDC, 6 decimals; default 100k)
contract Deploy is Script {
    function run() external returns (AeroUsdcWethVault vault) {
        require(block.chainid == 8453, "Base only");
        address owner = vm.envAddress("OWNER");
        address keeper = vm.envAddress("KEEPER");
        uint256 cap = vm.envOr("DEPOSIT_CAP", uint256(100_000e6));

        vm.startBroadcast();
        vault = new AeroUsdcWethVault(addresses(owner, keeper), cap);
        vm.stopBroadcast();
        console.log("AeroUsdcWethVault:", address(vault));
    }

    function addresses(address owner, address keeper) public pure returns (AeroUsdcWethVault.Addresses memory) {
        return AeroUsdcWethVault.Addresses({
            usdc: B.USDC,
            weth: B.WETH,
            aero: B.AERO,
            router: B.AERO_ROUTER,
            factory: B.AERO_POOL_FACTORY,
            uniRouter: B.UNI_SWAP_ROUTER02,
            uniFee: B.UNI_USDC_WETH_FEE,
            pool: B.VAMM_WETH_USDC,
            gauge: B.VAMM_WETH_USDC_GAUGE,
            ethUsdFeed: B.CL_ETH_USD,
            sequencerFeed: B.CL_SEQUENCER_UPTIME,
            owner: owner,
            keeper: keeper
        });
    }
}

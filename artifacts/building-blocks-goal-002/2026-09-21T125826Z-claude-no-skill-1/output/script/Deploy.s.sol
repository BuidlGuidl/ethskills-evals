// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {AeroUsdcWethVault} from "../src/AeroUsdcWethVault.sol";
import {IAeroVoter} from "../src/interfaces/IAerodrome.sol";
import {BaseAddresses as B} from "./BaseAddresses.sol";

/// @notice Deploys the vault on Base.
///   OWNER=0x.. KEEPER=0x.. DEPOSIT_CAP=100000000000 \
///   forge script script/Deploy.s.sol --rpc-url base --broadcast --verify --account deployer
contract Deploy is Script {
    function run() external returns (AeroUsdcWethVault vault) {
        require(block.chainid == 8453, "not Base");
        address owner = vm.envAddress("OWNER");
        address keeper = vm.envAddress("KEEPER");
        uint256 cap = vm.envOr("DEPOSIT_CAP", uint256(100_000e6));

        vm.startBroadcast();
        vault = new AeroUsdcWethVault(config(owner, keeper, cap));
        vm.stopBroadcast();

        console2.log("vault", address(vault));
        console2.log("gauge", address(vault.gauge()));
    }

    /// @dev Gauge is read from the Aerodrome Voter so it always matches the pool.
    function config(address owner, address keeper, uint256 cap) public view returns (AeroUsdcWethVault.Config memory) {
        return AeroUsdcWethVault.Config({
            usdc: B.USDC,
            weth: B.WETH,
            aero: B.AERO,
            router: B.AERO_ROUTER,
            pool: B.VAMM_WETH_USDC,
            gauge: IAeroVoter(B.AERO_VOTER).gauges(B.VAMM_WETH_USDC),
            ethUsdFeed: B.CL_ETH_USD,
            usdcUsdFeed: B.CL_USDC_USD,
            sequencerFeed: B.CL_SEQUENCER,
            ethUsdHeartbeat: B.ETH_USD_MAX_AGE,
            usdcUsdHeartbeat: B.USDC_USD_MAX_AGE,
            owner: owner,
            keeper: keeper,
            depositCap: cap
        });
    }
}

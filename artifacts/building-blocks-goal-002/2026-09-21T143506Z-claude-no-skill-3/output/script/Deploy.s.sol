// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {YieldVault} from "../src/YieldVault.sol";
import {AerodromeStrategy} from "../src/AerodromeStrategy.sol";
import {BaseAddresses as B} from "./BaseAddresses.sol";

/// forge script script/Deploy.s.sol --rpc-url base --broadcast --verify
/// env: OWNER, KEEPER, DEPOSIT_CAP (USDC units, e.g. 100000e6)
contract Deploy is Script {
    function run() external returns (YieldVault vault, AerodromeStrategy strategy) {
        require(block.chainid == 8453, "Base only");
        address owner = vm.envAddress("OWNER");
        address keeper = vm.envAddress("KEEPER");
        uint256 cap = vm.envUint("DEPOSIT_CAP");

        vm.startBroadcast();
        address deployer = msg.sender;
        // Deployer owns both until wiring is done, then ownership moves to OWNER.
        vault = new YieldVault(IERC20(B.USDC), deployer, cap);
        strategy = new AerodromeStrategy(config(address(vault)), owner, keeper);
        vault.setStrategy(strategy);
        vault.transferOwnership(owner);
        vm.stopBroadcast();

        console.log("vault", address(vault));
        console.log("strategy", address(strategy));
    }

    function config(address vault) public pure returns (AerodromeStrategy.Config memory) {
        return AerodromeStrategy.Config({
            vault: vault,
            usdc: B.USDC,
            weth: B.WETH,
            aero: B.AERO,
            router: B.AERO_ROUTER,
            gauge: B.WETH_USDC_GAUGE,
            ethUsdFeed: B.CL_ETH_USD,
            usdcUsdFeed: B.CL_USDC_USD,
            aeroUsdFeed: B.CL_AERO_USD,
            sequencerFeed: B.CL_SEQUENCER_UPTIME,
            ethMaxAge: B.ETH_MAX_AGE,
            usdcMaxAge: B.USDC_MAX_AGE,
            aeroMaxAge: B.AERO_MAX_AGE
        });
    }
}

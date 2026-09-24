// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {YieldVault} from "../src/YieldVault.sol";
import {AerodromeUsdcWethStrategy} from "../src/AerodromeUsdcWethStrategy.sol";
import {BaseAddresses as A} from "../src/BaseAddresses.sol";

/// Usage: OWNER=0x.. KEEPER=0x.. DEPOSIT_CAP=100000000000 \
///   forge script script/Deploy.s.sol --rpc-url base --broadcast --verify
contract Deploy is Script {
    function run() external returns (YieldVault vault, AerodromeUsdcWethStrategy strategy) {
        require(block.chainid == 8453, "Base only");
        address owner = vm.envAddress("OWNER");
        address keeper = vm.envAddress("KEEPER");
        uint256 cap = vm.envOr("DEPOSIT_CAP", uint256(100_000e6));

        vm.startBroadcast();
        address deployer = msg.sender;
        // Deployer owns the vault until the strategy is wired, then hands off to OWNER.
        vault = new YieldVault(IERC20(A.USDC), deployer, keeper, cap);
        strategy = new AerodromeUsdcWethStrategy(config(address(vault)), owner);
        vault.setStrategy(strategy);
        if (owner != deployer) vault.transferOwnership(owner); // OWNER must call acceptOwnership()
        vm.stopBroadcast();

        console.log("vault", address(vault));
        console.log("strategy", address(strategy));
    }

    function config(address vault) public pure returns (AerodromeUsdcWethStrategy.Config memory) {
        return AerodromeUsdcWethStrategy.Config({
            vault: vault,
            usdc: A.USDC,
            weth: A.WETH,
            aero: A.AERO,
            router: A.AERO_ROUTER,
            factory: A.AERO_POOL_FACTORY,
            voter: A.AERO_VOTER,
            pool: A.VAMM_WETH_USDC,
            gauge: A.VAMM_WETH_USDC_GAUGE,
            aeroUsdcPool: A.VAMM_USDC_AERO,
            ethUsdFeed: A.CL_ETH_USD,
            usdcUsdFeed: A.CL_USDC_USD,
            aeroUsdFeed: A.CL_AERO_USD,
            sequencerFeed: A.CL_SEQUENCER_UPTIME
        });
    }
}

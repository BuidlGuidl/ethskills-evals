// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {YieldVault} from "../src/YieldVault.sol";
import {AerodromeUsdcWethStrategy} from "../src/AerodromeUsdcWethStrategy.sol";
import {IStrategy} from "../src/interfaces/IStrategy.sol";
import {IAerodromePoolFactory, IAerodromeVoter} from "../src/interfaces/IAerodrome.sol";
import {BaseAddresses as B} from "./BaseAddresses.sol";

/// @notice Deploys vault + strategy on Base. Env: OWNER, KEEPER, DEPOSIT_CAP (USDC, 6 decimals).
///         Pool and gauge are resolved onchain from the Aerodrome factory/voter, not hardcoded.
contract Deploy is Script {
    function run() external returns (YieldVault vault, AerodromeUsdcWethStrategy strategy) {
        require(block.chainid == 8453, "Base only");
        address owner = vm.envAddress("OWNER");
        address keeper = vm.envAddress("KEEPER");
        uint256 cap = vm.envOr("DEPOSIT_CAP", uint256(50_000e6));

        address pool = IAerodromePoolFactory(B.AERO_POOL_FACTORY).getPool(B.WETH, B.USDC, false);
        address gauge = IAerodromeVoter(B.AERO_VOTER).gauges(pool);
        require(pool != address(0) && IAerodromeVoter(B.AERO_VOTER).isAlive(gauge), "pool/gauge");

        vm.startBroadcast();
        address deployer = msg.sender;
        // Deployer owns the vault briefly to wire the strategy, then hands over (OWNER must acceptOwnership).
        vault = new YieldVault(IERC20(B.USDC), deployer, keeper, cap);
        strategy = new AerodromeUsdcWethStrategy(
            AerodromeUsdcWethStrategy.Config({
                vault: address(vault),
                usdc: B.USDC,
                weth: B.WETH,
                aero: B.AERO,
                router: B.AERO_ROUTER,
                poolFactory: B.AERO_POOL_FACTORY,
                pool: pool,
                gauge: gauge,
                ethUsdFeed: B.CHAINLINK_ETH_USD,
                sequencerFeed: B.CHAINLINK_SEQUENCER_UPTIME
            }),
            owner
        );
        vault.setStrategy(IStrategy(address(strategy)));
        if (owner != deployer) vault.transferOwnership(owner);
        vm.stopBroadcast();

        console.log("pool", pool);
        console.log("gauge", gauge);
        console.log("vault", address(vault));
        console.log("strategy", address(strategy));
    }
}

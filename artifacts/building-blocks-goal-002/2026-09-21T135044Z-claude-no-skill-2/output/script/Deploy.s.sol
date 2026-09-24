// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {AerodromeUsdcVault} from "../src/AerodromeUsdcVault.sol";
import {BaseAddresses} from "./BaseAddresses.sol";

/// forge script script/Deploy.s.sol --rpc-url base --broadcast --verify --account <keystore>
/// env: OWNER (multisig), KEEPER, FEE_RECIPIENT, DEPOSIT_CAP (USDC base units, 6 decimals)
contract Deploy is Script {
    function run() external returns (AerodromeUsdcVault vault) {
        require(block.chainid == 8453, "Base mainnet only");
        address owner = vm.envAddress("OWNER");
        address keeper = vm.envAddress("KEEPER");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");
        uint256 cap = vm.envUint("DEPOSIT_CAP");

        vm.startBroadcast();
        vault = new AerodromeUsdcVault(BaseAddresses.vaultConfig(keeper, feeRecipient), cap, owner);
        vm.stopBroadcast();

        console.log("AerodromeUsdcVault:", address(vault));
    }
}

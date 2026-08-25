// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";

/// @notice The payday transaction: settle a batch of accounts, then sweep revenue to the
/// recipient. This is the only recurring transaction in the whole system, and the operator sends
/// it because it is the only way to get paid.
///
/// The account list comes from the event log, not from onchain storage — the contract does not
/// keep an array of subscribers, because iterating one would eventually cost more gas than a
/// block holds. `backend/scripts/subscribers.js` writes the list to `accounts.txt` for you.
///
///   node backend/scripts/subscribers.js > accounts.txt
///   forge script script/Sweep.s.sol --rpc-url base --broadcast
///
/// Anyone can send this. It cannot pay anyone but `revenueRecipient`, so if you want it automated
/// you can hand the job to a hot key with no special privileges and nothing worth stealing.
contract Sweep is Script {
    function run() external {
        SubscriptionBilling billing = SubscriptionBilling(vm.envAddress("BILLING_ADDRESS"));
        address[] memory accounts = _readAccounts(vm.envOr("ACCOUNTS_FILE", string("accounts.txt")));

        uint256 pending = billing.pendingOfMany(accounts);
        console2.log("accounts       :", accounts.length);
        console2.log("pending (units):", pending);
        console2.log("claimable now  :", billing.claimable());

        if (pending == 0 && billing.claimable() == 0) {
            console2.log("Nothing to do.");
            return;
        }

        vm.startBroadcast();
        (uint256 settled, uint256 collected) = billing.settleAndCollect(accounts);
        vm.stopBroadcast();

        console2.log("settled        :", settled);
        console2.log("collected      :", collected);
        console2.log("sent to        :", billing.revenueRecipient());
    }

    /// @dev One 0x-prefixed address per line.
    function _readAccounts(string memory path) internal view returns (address[] memory out) {
        string[] memory lines = vm.split(vm.trim(vm.readFile(path)), "\n");
        out = new address[](lines.length);
        uint256 n;
        for (uint256 i; i < lines.length; ++i) {
            string memory line = vm.trim(lines[i]);
            if (bytes(line).length == 42) out[n++] = vm.parseAddress(line);
        }
        assembly {
            mstore(out, n)
        }
    }
}

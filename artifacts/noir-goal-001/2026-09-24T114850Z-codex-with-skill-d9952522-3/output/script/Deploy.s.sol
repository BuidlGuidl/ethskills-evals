// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {AnonymousVoting} from "../src/AnonymousVoting.sol";
import {IVerifier as AppVerifier} from "../src/interfaces/IVerifier.sol";
import {HonkVerifier} from "../src/Verifier.sol";

contract Deploy is Script {
    function run() external returns (MembershipNFT membership, HonkVerifier verifier, AnonymousVoting voting) {
        vm.startBroadcast();

        membership = new MembershipNFT(msg.sender);
        verifier = new HonkVerifier();
        voting = new AnonymousVoting(membership, AppVerifier(address(verifier)));

        vm.stopBroadcast();
    }
}

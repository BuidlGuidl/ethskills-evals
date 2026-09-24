// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {PrivateVote} from "../src/PrivateVote.sol";
import {SimpleMembershipNFT} from "../src/SimpleMembershipNFT.sol";
import {IVerifier} from "../src/IVerifier.sol";
import {HonkVerifier} from "../src/Verifier.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract DeployLocal {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (SimpleMembershipNFT membership, HonkVerifier verifier, PrivateVote vote) {
        vm.startBroadcast();
        membership = new SimpleMembershipNFT();
        verifier = new HonkVerifier();
        vote = new PrivateVote(membership, IVerifier(address(verifier)));
        vm.stopBroadcast();
    }
}


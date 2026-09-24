// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/PrivateVote.sol";
import "../src/Verifier.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract Deploy {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (DemoMembershipNFT membership, PrivateVote vote) {
        vm.startBroadcast();
        HonkVerifier verifier = new HonkVerifier();
        membership = new DemoMembershipNFT();
        vote = new PrivateVote(IMembershipNFT(address(membership)), INoirVerifier(address(verifier)));
        vm.stopBroadcast();
    }
}

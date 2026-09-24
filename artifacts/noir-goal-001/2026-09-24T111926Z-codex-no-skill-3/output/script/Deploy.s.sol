// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {MembershipNFT} from "../src/MembershipNFT.sol";
import {PrivateGovernor} from "../src/PrivateGovernor.sol";
import {IProofVerifier} from "../src/IProofVerifier.sol";
import {HonkVerifier} from "../src/Verifier.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract Deploy {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (MembershipNFT membership, HonkVerifier verifier, PrivateGovernor governor) {
        vm.startBroadcast();

        membership = new MembershipNFT();
        verifier = new HonkVerifier();
        governor = new PrivateGovernor(membership, IProofVerifier(address(verifier)));

        vm.stopBroadcast();
    }
}

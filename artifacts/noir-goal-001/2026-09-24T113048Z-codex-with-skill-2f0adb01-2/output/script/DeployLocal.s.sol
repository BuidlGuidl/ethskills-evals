// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console2} from "forge-std/Script.sol";
import {HonkVerifier} from "../contracts/src/verifiers/HonkVerifier.sol";
import {NoirPrivateVoting} from "../contracts/src/NoirPrivateVoting.sol";
import {SimpleMembershipNFT} from "../contracts/src/SimpleMembershipNFT.sol";

contract DeployLocal is Script {
    address internal constant ANVIL_MEMBER = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address internal constant ANVIL_MEMBER_TWO = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;

    function run() external {
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.startBroadcast();

        HonkVerifier verifier = new HonkVerifier();
        SimpleMembershipNFT membership = new SimpleMembershipNFT();
        NoirPrivateVoting voting = new NoirPrivateVoting(address(verifier), address(membership));

        membership.mint(ANVIL_MEMBER);
        membership.mint(ANVIL_MEMBER_TWO);
        uint256 proposalId = voting.createProposal(deadline);

        vm.stopBroadcast();

        console2.log("HonkVerifier", address(verifier));
        console2.log("SimpleMembershipNFT", address(membership));
        console2.log("NoirPrivateVoting", address(voting));
        console2.log("proposalId", proposalId);
        console2.log("deadline", deadline);
    }
}

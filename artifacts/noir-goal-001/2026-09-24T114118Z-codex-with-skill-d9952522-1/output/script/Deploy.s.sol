// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {HonkVerifier} from "../src/Verifier.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {PrivateVote} from "../src/PrivateVote.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract DeployLocal {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address internal constant ANVIL_MEMBER =
        0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address internal constant ANVIL_MEMBER_TWO =
        0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
    address internal constant ANVIL_MEMBER_THREE =
        0x90F79bf6EB2c4f870365E785982E1f101E93b906;

    function run()
        external
        returns (MembershipNFT membership, HonkVerifier verifier, PrivateVote privateVote)
    {
        vm.startBroadcast();

        membership = new MembershipNFT();
        verifier = new HonkVerifier();
        privateVote = new PrivateVote(address(verifier), address(membership));

        membership.mint(ANVIL_MEMBER);
        membership.mint(ANVIL_MEMBER_TWO);
        membership.mint(ANVIL_MEMBER_THREE);

        privateVote.createProposal(1, uint64(block.timestamp + 1 days));

        vm.stopBroadcast();
    }
}

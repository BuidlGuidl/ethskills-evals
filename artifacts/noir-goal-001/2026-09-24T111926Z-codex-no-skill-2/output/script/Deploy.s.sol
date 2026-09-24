// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MembershipNFT} from "../src/MembershipNFT.sol";
import {MemberRootRegistry} from "../src/MemberRootRegistry.sol";
import {AnonymousVoting} from "../src/AnonymousVoting.sol";
import {HonkVerifier} from "../src/Verifier.sol";

interface Vm {
    function envOr(string calldata name, uint256 defaultValue) external view returns (uint256);
    function envOr(string calldata name, bytes32 defaultValue) external view returns (bytes32);
    function envOr(string calldata name, string calldata defaultValue) external view returns (string memory);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract Deploy {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (MembershipNFT nft, MemberRootRegistry roots, HonkVerifier verifier, AnonymousVoting voting) {
        uint256 deployerKey =
            vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        bytes32 initialRoot = vm.envOr("MEMBER_ROOT", bytes32(0));
        uint256 proposalId = vm.envOr("PROPOSAL_ID", uint256(1));
        uint256 deadlineSeconds = vm.envOr("DEADLINE_SECONDS", uint256(1 days));
        string memory proposalMetadata = vm.envOr("PROPOSAL_METADATA", string("ipfs://proposal-1"));

        vm.startBroadcast(deployerKey);
        nft = new MembershipNFT();
        roots = new MemberRootRegistry(address(nft), initialRoot);
        verifier = new HonkVerifier();
        voting = new AnonymousVoting(address(verifier), address(roots));
        voting.createProposal(proposalId, proposalMetadata, uint64(block.timestamp + deadlineSeconds));
        vm.stopBroadcast();
    }
}

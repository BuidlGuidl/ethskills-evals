// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {PrivateVoteGovernor} from "../src/PrivateVoteGovernor.sol";
import {MockMembershipNFT} from "../src/test/MockMembershipNFT.sol";
import {HonkVerifier} from "../src/verifiers/HonkVerifier.sol";

interface Vm {
    function addr(uint256 privateKey) external returns (address);
    function envOr(string calldata name, uint256 defaultValue) external view returns (uint256);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract DeployLocal {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant DEFAULT_ANVIL_PRIVATE_KEY =
        0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    function run() external returns (MockMembershipNFT membership, HonkVerifier verifier, PrivateVoteGovernor governor) {
        uint256 deployerKey = vm.envOr("PRIVATE_KEY", DEFAULT_ANVIL_PRIVATE_KEY);
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        membership = new MockMembershipNFT();
        membership.mint(deployer);

        verifier = new HonkVerifier();
        governor = new PrivateVoteGovernor(address(membership), address(verifier));

        uint64 joinDeadline = uint64(block.timestamp + 1 hours);
        uint64 voteDeadline = uint64(block.timestamp + 2 hours);
        governor.createProposal(joinDeadline, voteDeadline);

        vm.stopBroadcast();
    }
}


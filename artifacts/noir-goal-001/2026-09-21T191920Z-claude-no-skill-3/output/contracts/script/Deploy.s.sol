// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {MembershipNFT, IMembershipNFT} from "../src/MembershipNFT.sol";
import {VoterRegistry} from "../src/VoterRegistry.sol";
import {AnonymousVoting} from "../src/AnonymousVoting.sol";
import {HonkVerifier} from "../src/HonkVerifier.sol";

/// Deploys and wires: [MembershipNFT] -> VoterRegistry -> AnonymousVoting <- HonkVerifier.
/// PoseidonT3 is deployed and linked automatically by forge.
///
/// Env:
///   NFT_ADDRESS        existing membership NFT (omit locally to deploy a stand-in)
///   MEMBERS            comma-separated addresses to mint stand-in NFTs to (local only)
///   MIN_ANONYMITY_SET  minimum registered members before a proposal can open (default 3)
contract Deploy is Script {
    function run() external {
        address nftAddr = vm.envOr("NFT_ADDRESS", address(0));
        uint256 minSet = vm.envOr("MIN_ANONYMITY_SET", uint256(3));
        address[] memory members = vm.envOr("MEMBERS", ",", new address[](0));

        vm.startBroadcast();
        if (nftAddr == address(0)) {
            MembershipNFT stand_in = new MembershipNFT(msg.sender);
            for (uint256 i = 0; i < members.length; i++) {
                stand_in.mint(members[i]);
            }
            nftAddr = address(stand_in);
        }
        VoterRegistry registry = new VoterRegistry(IMembershipNFT(nftAddr));
        HonkVerifier verifier = new HonkVerifier();
        AnonymousVoting voting = new AnonymousVoting(registry, verifier, minSet);
        vm.stopBroadcast();

        console.log("MembershipNFT  ", nftAddr);
        console.log("VoterRegistry  ", address(registry));
        console.log("HonkVerifier   ", address(verifier));
        console.log("AnonymousVoting", address(voting));

        string memory k = "deployment";
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeUint(k, "deployBlock", block.number);
        vm.serializeAddress(k, "nft", nftAddr);
        vm.serializeAddress(k, "registry", address(registry));
        vm.serializeAddress(k, "verifier", address(verifier));
        string memory json = vm.serializeAddress(k, "voting", address(voting));
        vm.writeJson(json, string.concat(vm.projectRoot(), "/../deployments/", vm.toString(block.chainid), ".json"));
    }
}

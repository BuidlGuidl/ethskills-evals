// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {HonkVerifier} from "../verifier/HonkVerifier.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {MemberGroup, IMembershipNFT} from "../src/MemberGroup.sol";
import {AnonymousVoting} from "../src/AnonymousVoting.sol";

/// Deploys and wires: MembershipNFT -> MemberGroup -> AnonymousVoting <- HonkVerifier.
///
/// Env:
///   PRIVATE_KEY          deployer (DAO admin) key
///   MEMBERSHIP_NFT       optional: existing NFT address; if unset a demo NFT is deployed
///   DEMO_MEMBERS         optional: comma-separated addresses to mint demo NFTs to
///   MIN_ANONYMITY_SET    optional, default 3
/// Writes deployments/<chainid>.json for the Node scripts.
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address nftAddr = vm.envOr("MEMBERSHIP_NFT", address(0));
        address[] memory demoMembers = vm.envOr("DEMO_MEMBERS", ",", new address[](0));
        uint256 minAnon = vm.envOr("MIN_ANONYMITY_SET", uint256(3));

        vm.startBroadcast(pk);
        if (nftAddr == address(0)) {
            MembershipNFT nft = new MembershipNFT(deployer);
            for (uint256 i = 0; i < demoMembers.length; i++) {
                nft.mint(demoMembers[i]);
            }
            nftAddr = address(nft);
        }
        HonkVerifier verifier = new HonkVerifier();
        MemberGroup group = new MemberGroup(IMembershipNFT(nftAddr));
        AnonymousVoting voting = new AnonymousVoting(group, verifier, minAnon);
        vm.stopBroadcast();

        console.log("MembershipNFT  ", nftAddr);
        console.log("HonkVerifier   ", address(verifier));
        console.log("MemberGroup    ", address(group));
        console.log("AnonymousVoting", address(voting));

        string memory k = "deployment";
        vm.serializeAddress(k, "membershipNFT", nftAddr);
        vm.serializeAddress(k, "verifier", address(verifier));
        vm.serializeAddress(k, "memberGroup", address(group));
        vm.serializeUint(k, "deployBlock", block.number);
        string memory json = vm.serializeAddress(k, "anonymousVoting", address(voting));
        vm.createDir("deployments", true);
        vm.writeJson(json, string.concat("deployments/", vm.toString(block.chainid), ".json"));
    }
}

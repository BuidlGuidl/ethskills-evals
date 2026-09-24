// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console2} from "forge-std/Script.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {HonkVerifier} from "../src/HonkVerifier.sol";
import {AnonVoting} from "../src/AnonVoting.sol";

/// Deploys HonkVerifier + AnonVoting (PoseidonT3 is linked automatically) and
/// wires AnonVoting to the verifier and the membership NFT.
///
/// Env:
///   MEMBERSHIP_NFT      existing NFT address; if unset a MembershipNFT is deployed
///   DEMO_MEMBERS        comma-separated addresses to mint NFTs to (local only)
///   MIN_ANONYMITY_SET   default 3
///
/// Writes deployments/<chainid>.json for the Node scripts.
contract Deploy is Script {
    function run() external {
        address nftAddr = vm.envOr("MEMBERSHIP_NFT", address(0));
        uint256 minSet = vm.envOr("MIN_ANONYMITY_SET", uint256(3));
        address[] memory demoMembers = vm.envOr("DEMO_MEMBERS", ",", new address[](0));

        vm.startBroadcast();
        if (nftAddr == address(0)) {
            MembershipNFT nft = new MembershipNFT(msg.sender);
            for (uint256 i = 0; i < demoMembers.length; i++) {
                nft.mint(demoMembers[i]);
            }
            nftAddr = address(nft);
        }
        HonkVerifier verifier = new HonkVerifier();
        AnonVoting voting = new AnonVoting(IERC721(nftAddr), verifier, minSet);
        vm.stopBroadcast();

        console2.log("MembershipNFT", nftAddr);
        console2.log("HonkVerifier ", address(verifier));
        console2.log("AnonVoting   ", address(voting));

        string memory k = "deployment";
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeUint(k, "deployBlock", block.number);
        vm.serializeAddress(k, "membershipNFT", nftAddr);
        vm.serializeAddress(k, "verifier", address(verifier));
        string memory json = vm.serializeAddress(k, "anonVoting", address(voting));
        vm.writeJson(json, string.concat("./deployments/", vm.toString(block.chainid), ".json"));
    }
}

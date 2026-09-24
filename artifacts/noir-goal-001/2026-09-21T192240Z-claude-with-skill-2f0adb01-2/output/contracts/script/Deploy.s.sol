// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {HonkVerifier} from "../src/verifiers/HonkVerifier.sol";
import {AnonVoting, IMembership, IVerifier} from "../src/AnonVoting.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";

/// Deploys: HonkVerifier -> (MembershipNFT, local only) -> AnonVoting(nft, verifier).
/// PoseidonT3 and LeanIMT are external libraries; forge deploys and links them
/// automatically as part of this broadcast.
///
/// Env:
///   MEMBERSHIP_NFT     existing membership NFT (omit locally to deploy MembershipNFT)
///   DEMO_MEMBERS       comma-separated addresses to mint local NFTs to
///   MIN_ANONYMITY_SET  registered members required before proposals open (default 3)
contract Deploy is Script {
    function run() external {
        address nft = vm.envOr("MEMBERSHIP_NFT", address(0));
        uint256 minSet = vm.envOr("MIN_ANONYMITY_SET", uint256(3));
        address[] memory demoMembers = vm.envOr("DEMO_MEMBERS", ",", new address[](0));
        uint256 deployBlock = block.number;

        vm.startBroadcast();
        HonkVerifier verifier = new HonkVerifier();
        if (nft == address(0)) {
            MembershipNFT local = new MembershipNFT();
            for (uint256 i; i < demoMembers.length; i++) {
                local.mint(demoMembers[i]);
            }
            nft = address(local);
        }
        AnonVoting voting = new AnonVoting(IMembership(nft), IVerifier(address(verifier)), minSet);
        vm.stopBroadcast();

        console.log("HonkVerifier ", address(verifier));
        console.log("MembershipNFT", nft);
        console.log("AnonVoting   ", address(voting));

        string memory k = "deployment";
        vm.serializeAddress(k, "verifier", address(verifier));
        vm.serializeAddress(k, "membership", nft);
        vm.serializeUint(k, "minAnonymitySet", minSet);
        vm.serializeUint(k, "deployBlock", deployBlock);
        string memory json = vm.serializeAddress(k, "voting", address(voting));
        vm.writeJson(json, string.concat("./deployments/", vm.toString(block.chainid), ".json"));
    }
}

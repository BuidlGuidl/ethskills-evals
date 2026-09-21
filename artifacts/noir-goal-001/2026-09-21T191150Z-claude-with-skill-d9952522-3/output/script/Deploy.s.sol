// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {HonkVerifier, IVerifier} from "../contracts/HonkVerifier.sol";
import {AnonymousVoting} from "../contracts/AnonymousVoting.sol";
import {MembershipNFT} from "../contracts/MembershipNFT.sol";

/// Stands up the voting stack and wires it together:
///   HonkVerifier (generated from circuits/vote) ─┐
///   Membership NFT (existing, or a demo one) ────┼─> AnonymousVoting
///   PoseidonT3 library (auto-deployed + linked) ─┘
///
/// Env:
///   MEMBERSHIP_NFT     address of the DAO's existing NFT; unset => deploy MembershipNFT and mint
///   DEMO_MEMBERS       comma-separated addresses to mint demo NFTs to (only with the demo NFT)
///   MIN_ANONYMITY_SET  smallest member tree a proposal may open over (default 2)
contract Deploy is Script {
    function run() external {
        address nftAddr = vm.envOr("MEMBERSHIP_NFT", address(0));
        uint256 minSet = vm.envOr("MIN_ANONYMITY_SET", uint256(2));
        address[] memory demoMembers = vm.envOr("DEMO_MEMBERS", ",", new address[](0));

        vm.startBroadcast();
        address deployer = msg.sender;

        if (nftAddr == address(0)) {
            MembershipNFT nft = new MembershipNFT(deployer);
            for (uint256 i = 0; i < demoMembers.length; i++) {
                nft.mint(demoMembers[i]);
            }
            nftAddr = address(nft);
        }

        IVerifier verifier = new HonkVerifier();
        AnonymousVoting voting = new AnonymousVoting(IERC721(nftAddr), verifier, minSet);
        vm.stopBroadcast();

        require(address(voting.verifier()) == address(verifier), "verifier not wired");
        require(address(voting.membership()) == nftAddr, "nft not wired");

        console.log("MembershipNFT  ", nftAddr);
        console.log("HonkVerifier   ", address(verifier));
        console.log("AnonymousVoting", address(voting));

        string memory json = "deployment";
        vm.serializeUint(json, "chainId", block.chainid);
        vm.serializeAddress(json, "membershipNFT", nftAddr);
        vm.serializeAddress(json, "verifier", address(verifier));
        string memory out = vm.serializeAddress(json, "voting", address(voting));
        vm.writeJson(out, string.concat("./deployments/", vm.toString(block.chainid), ".json"));
    }
}

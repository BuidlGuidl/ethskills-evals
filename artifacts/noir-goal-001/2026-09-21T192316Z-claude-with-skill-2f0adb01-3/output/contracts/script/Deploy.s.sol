// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console2} from "forge-std/Script.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {HonkVerifier} from "../src/verifiers/HonkVerifier.sol";
import {IBallotVerifier} from "../src/interfaces/IBallotVerifier.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {AnonymousVoting} from "../src/AnonymousVoting.sol";

/// Stands the system up and wires it together:
///   HonkVerifier (generated, real — never a mock)
///   MembershipNFT (only if MEMBERSHIP_NFT is not given)
///   PoseidonT3 + LeanIMT libraries (linked into AnonymousVoting by forge)
///   AnonymousVoting(membership, verifier, minAnonymitySet)
/// and writes ../deployments/<chainId>.json for the Node scripts.
///
/// env: PRIVATE_KEY           deployer (DAO admin; mints NFTs in local mode)
///      MEMBERSHIP_NFT        optional existing ERC-721 address
///      MIN_ANONYMITY_SET     optional, default 100
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address nft = vm.envOr("MEMBERSHIP_NFT", address(0));
        uint256 minSet = vm.envOr("MIN_ANONYMITY_SET", uint256(100));
        uint256 startBlock = block.number;

        vm.startBroadcast(pk);
        HonkVerifier verifier = new HonkVerifier();
        if (nft == address(0)) nft = address(new MembershipNFT(deployer));
        AnonymousVoting voting = new AnonymousVoting(IERC721(nft), IBallotVerifier(address(verifier)), minSet);
        vm.stopBroadcast();

        console2.log("HonkVerifier   ", address(verifier));
        console2.log("MembershipNFT  ", nft);
        console2.log("AnonymousVoting", address(voting));

        string memory k = "deployment";
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeUint(k, "startBlock", startBlock);
        vm.serializeUint(k, "minAnonymitySet", minSet);
        vm.serializeAddress(k, "verifier", address(verifier));
        vm.serializeAddress(k, "membershipNFT", nft);
        string memory json = vm.serializeAddress(k, "voting", address(voting));
        vm.writeJson(json, string.concat("../deployments/", vm.toString(block.chainid), ".json"));
    }
}

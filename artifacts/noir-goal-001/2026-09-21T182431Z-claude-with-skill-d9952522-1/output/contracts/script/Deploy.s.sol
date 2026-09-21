// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {HonkVerifier} from "../src/VoteVerifier.sol";
import {MemberRegistry} from "../src/MemberRegistry.sol";
import {AnonymousVoting} from "../src/AnonymousVoting.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";

/// Deploys verifier -> registry(nft) -> voting(registry, verifier) and writes
/// the addresses to ../deployments/<chainid>.json for the Node scripts.
///
/// Env:
///   PRIVATE_KEY        deployer key (default: anvil account 0)
///   MEMBERSHIP_NFT     existing NFT address; if unset a local MembershipNFT is
///                      deployed and one token minted to each of MEMBERS
///   MEMBERS            comma-separated addresses to mint to (local NFT only)
///   MIN_ANONYMITY_SET  members required before a proposal can open (default 3)
contract Deploy is Script {
    uint256 constant ANVIL_KEY_0 = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    function run() external {
        uint256 pk = vm.envOr("PRIVATE_KEY", ANVIL_KEY_0);
        address nftAddr = vm.envOr("MEMBERSHIP_NFT", address(0));
        uint256 minSet = vm.envOr("MIN_ANONYMITY_SET", uint256(3));

        vm.startBroadcast(pk);

        if (nftAddr == address(0)) {
            MembershipNFT nft = new MembershipNFT(vm.addr(pk));
            address[] memory members = vm.envOr("MEMBERS", ",", _defaultMembers());
            for (uint256 i = 0; i < members.length; i++) {
                nft.mint(members[i]);
            }
            nftAddr = address(nft);
        }

        HonkVerifier verifier = new HonkVerifier();
        MemberRegistry registry = new MemberRegistry(IERC721(nftAddr));
        AnonymousVoting voting = new AnonymousVoting(registry, verifier, minSet);

        vm.stopBroadcast();

        string memory k = "deployment";
        vm.serializeAddress(k, "membershipNft", nftAddr);
        vm.serializeAddress(k, "verifier", address(verifier));
        vm.serializeAddress(k, "registry", address(registry));
        vm.serializeUint(k, "deployBlock", block.number);
        string memory json = vm.serializeAddress(k, "voting", address(voting));
        vm.writeJson(json, string.concat("../deployments/", vm.toString(block.chainid), ".json"));

        console.log("MembershipNFT  ", nftAddr);
        console.log("HonkVerifier   ", address(verifier));
        console.log("MemberRegistry ", address(registry));
        console.log("AnonymousVoting", address(voting));
    }

    /// anvil accounts 1..5 act as members locally (account 9 is the relayer).
    function _defaultMembers() internal returns (address[] memory m) {
        string memory mnemonic = "test test test test test test test test test test test junk";
        m = new address[](5);
        for (uint32 i = 0; i < 5; i++) {
            m[i] = vm.addr(vm.deriveKey(mnemonic, i + 1));
        }
    }
}

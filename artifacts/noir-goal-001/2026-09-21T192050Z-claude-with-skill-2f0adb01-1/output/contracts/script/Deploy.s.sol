// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {HonkVerifier, IVerifier} from "../src/verifier/HonkVerifier.sol";
import {AnonVoting} from "../src/AnonVoting.sol";
import {DemoMembershipNFT} from "../src/DemoMembershipNFT.sol";

/// Deploys and wires:  HonkVerifier  ─┐
///                     PoseidonT3 (linked library, auto-deployed by forge) ─┤→ AnonVoting
///                     membership NFT (existing, or a demo one locally) ─┘
///
/// Env:
///   MEMBERSHIP_NFT       existing NFT address. If unset, deploys DemoMembershipNFT and
///                        mints one token to each of anvil accounts 1..DEMO_MEMBERS.
///   DEMO_MEMBERS         default 5
///   MIN_ANONYMITY_SET    members that must be registered before a proposal can open.
///                        default 3 for the local demo; use a large fraction of the DAO
///                        (e.g. 100 of 150) in production.
///   DEPLOYMENT_FILE      default ../deployments/local.json
contract Deploy is Script {
    string constant ANVIL_MNEMONIC = "test test test test test test test test test test test junk";

    function run() external {
        address nftAddr = vm.envOr("MEMBERSHIP_NFT", address(0));
        uint256 demoMembers = vm.envOr("DEMO_MEMBERS", uint256(5));
        uint256 minSet = vm.envOr("MIN_ANONYMITY_SET", uint256(3));
        string memory outFile = vm.envOr("DEPLOYMENT_FILE", string("../deployments/local.json"));

        vm.startBroadcast();

        HonkVerifier verifier = new HonkVerifier();

        if (nftAddr == address(0)) {
            DemoMembershipNFT nft = new DemoMembershipNFT(msg.sender);
            for (uint32 i = 1; i <= demoMembers; i++) {
                nft.mint(vm.addr(vm.deriveKey(ANVIL_MNEMONIC, i)));
            }
            nftAddr = address(nft);
        }

        AnonVoting voting = new AnonVoting(IERC721(nftAddr), IVerifier(address(verifier)), minSet);

        vm.stopBroadcast();

        string memory o = "deployment";
        vm.serializeUint(o, "chainId", block.chainid);
        vm.serializeUint(o, "deployBlock", block.number);
        vm.serializeUint(o, "minAnonymitySet", minSet);
        vm.serializeAddress(o, "verifier", address(verifier));
        vm.serializeAddress(o, "membershipNFT", nftAddr);
        string memory json = vm.serializeAddress(o, "anonVoting", address(voting));
        vm.writeJson(json, outFile);

        console.log("HonkVerifier ", address(verifier));
        console.log("MembershipNFT", nftAddr);
        console.log("AnonVoting   ", address(voting));
        console.log("written to   ", outFile);
    }
}

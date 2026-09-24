// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {HonkVerifier} from "../src/HonkVerifier.sol";
import {IMembershipNFT} from "../src/IMembershipNFT.sol";
import {MemberRegistry} from "../src/MemberRegistry.sol";
import {AnonVoting} from "../src/AnonVoting.sol";
import {MockMembershipNFT} from "../src/mocks/MockMembershipNFT.sol";

/// Deploys HonkVerifier -> MemberRegistry(nft) -> AnonVoting(verifier, registry)
/// and writes the addresses to deployments/<chainid>.json for the Node scripts.
///
/// Env:
///   MEMBERSHIP_NFT      existing membership NFT. If unset, a MockMembershipNFT is
///                       deployed and one token minted to each address in MINT_TO.
///   MINT_TO             comma-separated addresses (local only)
///   MIN_ANONYMITY_SET   members that must be registered before a proposal can open (default 3)
///
/// Local:  forge script contracts/script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 \
///           --broadcast --private-key $DEPLOYER_KEY
contract Deploy is Script {
    function run() external {
        address nftAddr = vm.envOr("MEMBERSHIP_NFT", address(0));
        uint256 minSet = vm.envOr("MIN_ANONYMITY_SET", uint256(3));
        uint256 startBlock = block.number;

        vm.startBroadcast();
        if (nftAddr == address(0)) {
            MockMembershipNFT mock = new MockMembershipNFT();
            address[] memory to = vm.envOr("MINT_TO", ",", new address[](0));
            for (uint256 i = 0; i < to.length; i++) {
                uint256 id = mock.mint(to[i]);
                console.log("minted membership token", id, "to", to[i]);
            }
            nftAddr = address(mock);
        }
        HonkVerifier verifier = new HonkVerifier();
        MemberRegistry registry = new MemberRegistry(IMembershipNFT(nftAddr));
        AnonVoting voting = new AnonVoting(verifier, registry, minSet);
        vm.stopBroadcast();

        console.log("MembershipNFT ", nftAddr);
        console.log("HonkVerifier  ", address(verifier));
        console.log("MemberRegistry", address(registry));
        console.log("AnonVoting    ", address(voting));

        string memory j = "deployment";
        vm.serializeUint(j, "chainId", block.chainid);
        vm.serializeUint(j, "startBlock", startBlock);
        vm.serializeAddress(j, "membershipNFT", nftAddr);
        vm.serializeAddress(j, "verifier", address(verifier));
        vm.serializeAddress(j, "registry", address(registry));
        string memory out = vm.serializeAddress(j, "voting", address(voting));
        vm.createDir("deployments", true);
        vm.writeJson(out, string.concat("deployments/", vm.toString(block.chainid), ".json"));
    }
}

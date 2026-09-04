// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {MembershipNFT} from "../src/mocks/MembershipNFT.sol";
import {MembershipRegistry} from "../src/MembershipRegistry.sol";
import {PrivateBallot} from "../src/PrivateBallot.sol";
import {IERC721Minimal} from "../src/interfaces/IERC721Minimal.sol";
import {IVerifier} from "../src/interfaces/IVerifier.sol";
import {HonkVerifier} from "../src/verifiers/HonkVerifier.sol";

/// @notice Stands the system up on a local chain and wires it together:
///
///     MembershipNFT  <--reads--  MembershipRegistry  <--reads--  PrivateBallot
///                                                    --verifies-->  HonkVerifier
///
/// Set MEMBERSHIP_NFT to point the registry at the DAO's real collection; when
/// it is unset a stand-in NFT is deployed and handed to the first MEMBER_COUNT
/// accounts of the anvil mnemonic, so the demo has members to play with.
///
///   anvil
///   forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 \
///     --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
///     --broadcast
contract Deploy is Script {
    string internal constant ANVIL_MNEMONIC = "test test test test test test test test test test test junk";

    function run() external {
        uint256 memberCount = vm.envOr("MEMBER_COUNT", uint256(6));
        address existingNft = vm.envOr("MEMBERSHIP_NFT", address(0));

        vm.startBroadcast();

        address nft = existingNft;
        if (nft == address(0)) {
            MembershipNFT deployed = new MembershipNFT();
            for (uint256 i = 0; i < memberCount; i++) {
                deployed.mint(vm.addr(vm.deriveKey(ANVIL_MNEMONIC, uint32(i))), i + 1);
            }
            nft = address(deployed);
        }

        HonkVerifier verifier = new HonkVerifier();
        MembershipRegistry registry = new MembershipRegistry(IERC721Minimal(nft));
        PrivateBallot ballot = new PrivateBallot(registry, IVerifier(address(verifier)));

        vm.stopBroadcast();

        console2.log("membershipNft ", nft);
        console2.log("verifier      ", address(verifier));
        console2.log("registry      ", address(registry));
        console2.log("ballot        ", address(ballot));
        console2.log("members minted", existingNft == address(0) ? memberCount : 0);

        string memory out = "deployment";
        vm.serializeUint(out, "chainId", block.chainid);
        vm.serializeUint(out, "block", block.number);
        vm.serializeAddress(out, "membershipNft", nft);
        vm.serializeAddress(out, "verifier", address(verifier));
        vm.serializeAddress(out, "registry", address(registry));
        string memory json = vm.serializeAddress(out, "ballot", address(ballot));
        vm.writeJson(json, string.concat("./deployments/", vm.toString(block.chainid), ".json"));
    }
}

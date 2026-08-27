// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {AnonymousVoting} from "../src/AnonymousVoting.sol";
import {DemoMembershipNFT} from "../src/DemoMembershipNFT.sol";
import {IVerifier} from "../src/IVerifier.sol";
import {MembershipRegistry} from "../src/MembershipRegistry.sol";
import {HonkVerifier} from "../src/verifiers/HonkVerifier.sol";

/// @notice Stands the whole system up and wires it together.
///
///   HonkVerifier          generated from circuits/vote, standalone
///   MembershipRegistry -> the DAO's membership NFT
///   AnonymousVoting    -> HonkVerifier + MembershipRegistry
///
/// Local:  ./scripts/deploy-local.sh
/// Live:   MEMBERSHIP_NFT=0x... forge script script/Deploy.s.sol \
///           --rpc-url $RPC_URL --broadcast
///
/// Env:
///   MEMBERSHIP_NFT  existing membership NFT. If unset, a DemoMembershipNFT is
///                   deployed and minted to DEMO_MEMBERS local accounts.
///   DEMO_MEMBERS    how many demo NFTs to mint (default 20).
///   START_BLOCK     recorded in the deployment file as the first block clients
///                   need to scan for MemberJoined events. Defaults to 0, which
///                   is correct but slow on a chain with real history — set it
///                   to the deploy block when deploying for real.
contract Deploy is Script {
    /// Anvil's default mnemonic — only used to mint demo NFTs locally.
    string constant DEMO_MNEMONIC = "test test test test test test test test test test test junk";

    function run() external {
        uint256 deployerKey = vm.envOr("PRIVATE_KEY", uint256(0));
        if (deployerKey == 0) deployerKey = vm.deriveKey(DEMO_MNEMONIC, 0);
        address deployer = vm.addr(deployerKey);

        address existingNft = vm.envOr("MEMBERSHIP_NFT", address(0));
        uint256 demoMembers = vm.envOr("DEMO_MEMBERS", uint256(20));

        vm.startBroadcast(deployerKey);

        IERC721 membershipNft;
        if (existingNft == address(0)) {
            DemoMembershipNFT demoNft = new DemoMembershipNFT();
            for (uint32 i = 0; i < demoMembers; i++) {
                demoNft.mint(vm.addr(vm.deriveKey(DEMO_MNEMONIC, i)));
            }
            membershipNft = IERC721(address(demoNft));
        } else {
            membershipNft = IERC721(existingNft);
        }

        // The verifier is a standalone contract; the app contract only ever
        // holds its address.
        HonkVerifier verifier = new HonkVerifier();
        MembershipRegistry registry = new MembershipRegistry(membershipNft);

        // Ties every nullifier to this chain and this registry, so a member's
        // nullifier for proposal 3 here can never be matched against their
        // nullifier for proposal 3 anywhere else.
        bytes32 daoScopeSeed =
            keccak256(abi.encode(block.chainid, address(registry), "dao-anonymous-voting/v1"));

        AnonymousVoting voting = new AnonymousVoting(IVerifier(address(verifier)), registry, daoScopeSeed);

        vm.stopBroadcast();

        console.log("membershipNft     ", address(membershipNft));
        console.log("verifier          ", address(verifier));
        console.log("membershipRegistry", address(registry));
        console.log("anonymousVoting   ", address(voting));

        writeDeployment(deployer, address(membershipNft), address(verifier), address(registry), address(voting));
    }

    /// @dev deployments/<chainid>.json is the hand-off to the Node client.
    function writeDeployment(
        address deployer,
        address membershipNft,
        address verifier,
        address registry,
        address voting
    ) internal {
        string memory key = "deployment";
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeUint(key, "startBlock", vm.envOr("START_BLOCK", uint256(0)));
        vm.serializeAddress(key, "deployer", deployer);
        vm.serializeAddress(key, "membershipNft", membershipNft);
        vm.serializeAddress(key, "verifier", verifier);
        vm.serializeAddress(key, "membershipRegistry", registry);
        string memory json = vm.serializeAddress(key, "anonymousVoting", voting);

        vm.writeJson(json, string.concat("./deployments/", vm.toString(block.chainid), ".json"));
    }
}

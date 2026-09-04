// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {MemberRegistry} from "../src/MemberRegistry.sol";
import {AnonymousBallot, IVerifier} from "../src/AnonymousBallot.sol";
import {IMembership} from "../src/IMembership.sol";
import {HonkVerifier} from "../src/verifier/HonkVerifier.sol";

/// @notice Stands the whole system up on a local chain and wires it together.
///
///   forge script contracts/script/Deploy.s.sol:Deploy \
///     --rpc-url http://127.0.0.1:8545 --broadcast
///
/// Note this deploys FOUR contracts plus one library: forge links PoseidonT3
/// (a `public` library, so it lives at its own address) into MemberRegistry
/// automatically.
///
/// It does NOT register anybody. Registration requires a secret that only the
/// member should ever hold, so it happens from the member's own machine —
/// see scripts/join.mjs.
contract Deploy is Script {
    /// @dev Anvil's default mnemonic. Override with MNEMONIC for other chains.
    string constant DEFAULT_MNEMONIC = "test test test test test test test test test test test junk";

    function run() external {
        uint256 deployerKey = vm.envOr("PRIVATE_KEY", uint256(0));
        string memory mnemonic = vm.envOr("MNEMONIC", DEFAULT_MNEMONIC);
        if (deployerKey == 0) deployerKey = vm.deriveKey(mnemonic, 0);

        // How many membership NFTs to mint. The real DAO has 150; the local
        // demo mints fewer so `forge script` stays quick. Every one of these is
        // a wallet that COULD join the registry — the anonymity set can never be
        // larger than this.
        uint256 memberCount = vm.envOr("MEMBER_COUNT", uint256(12));
        // A proposal refuses to open below this many joined members. 8 is a
        // demo figure; for a 150-seat DAO pick something that makes a leak of
        // "one of N" genuinely uninformative.
        uint64 minAnonymitySet = uint64(vm.envOr("MIN_ANONYMITY_SET", uint256(8)));
        // The wallet that will broadcast ballots. Deliberately NOT one of the
        // member wallets and NOT the deployer: it must hold no membership NFT,
        // so that being the sender of a ballot says nothing about who voted.
        uint256 relayerIndex = vm.envOr("RELAYER_INDEX", uint256(19));

        address deployer = vm.addr(deployerKey);
        vm.startBroadcast(deployerKey);

        MembershipNFT membership = new MembershipNFT(deployer);

        // Mint one seat per member wallet. Public and meant to be: the DAO
        // roster is on the website already.
        address[] memory members = new address[](memberCount);
        for (uint256 i = 0; i < memberCount; ++i) {
            members[i] = vm.addr(vm.deriveKey(mnemonic, uint32(i + 1)));
            membership.issue(members[i]);
        }

        // Local-chain convenience only: `anvil` funds just its first 10
        // accounts, and the demo uses more than that. Real members already hold
        // gas. Skipped on any chain that is not 31337.
        if (block.chainid == 31337) {
            for (uint256 i = 0; i < memberCount; ++i) {
                if (members[i].balance < 0.05 ether) payable(members[i]).transfer(1 ether);
            }
            address relayer = vm.addr(vm.deriveKey(mnemonic, uint32(relayerIndex)));
            if (relayer.balance < 0.05 ether) payable(relayer).transfer(1 ether);
            console2.log("relayer         ", relayer);
        }

        MemberRegistry registry = new MemberRegistry(IMembership(address(membership)));
        HonkVerifier verifier = new HonkVerifier();
        AnonymousBallot ballot = new AnonymousBallot(
            IMembership(address(membership)), registry, IVerifier(address(verifier)), minAnonymitySet
        );

        vm.stopBroadcast();

        console2.log("MembershipNFT   ", address(membership));
        console2.log("MemberRegistry  ", address(registry));
        console2.log("HonkVerifier    ", address(verifier));
        console2.log("AnonymousBallot ", address(ballot));
        console2.log("members minted  ", memberCount);

        _write(address(membership), address(registry), address(verifier), address(ballot), memberCount, minAnonymitySet);
    }

    function _write(
        address membership,
        address registry,
        address verifier,
        address ballot,
        uint256 memberCount,
        uint64 minAnonymitySet
    ) internal {
        string memory o = "deployment";
        vm.serializeUint(o, "chainId", block.chainid);
        vm.serializeAddress(o, "membershipNFT", membership);
        vm.serializeAddress(o, "memberRegistry", registry);
        vm.serializeAddress(o, "honkVerifier", verifier);
        vm.serializeUint(o, "memberCount", memberCount);
        vm.serializeUint(o, "minAnonymitySet", minAnonymitySet);
        vm.serializeUint(o, "deployBlock", block.number);
        vm.serializeAddress(o, "relayer", vm.addr(vm.deriveKey(vm.envOr("MNEMONIC", DEFAULT_MNEMONIC), uint32(vm.envOr("RELAYER_INDEX", uint256(19))))));
        string memory json = vm.serializeAddress(o, "anonymousBallot", ballot);

        // deployments/ is gitignored, so on a fresh clone it does not exist and
        // vm.writeJson would fail rather than create it.
        string memory dir = string.concat(vm.projectRoot(), "/deployments");
        if (!vm.isDir(dir)) vm.createDir(dir, true);

        string memory path = string.concat(dir, "/local.json");
        vm.writeJson(json, path);
        console2.log("wrote", path);
    }
}

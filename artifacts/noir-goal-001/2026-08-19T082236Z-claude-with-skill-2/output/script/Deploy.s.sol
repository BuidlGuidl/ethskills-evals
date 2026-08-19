// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {MembershipNFT} from "../contracts/MembershipNFT.sol";
import {VoterRegistry} from "../contracts/VoterRegistry.sol";
import {AnonVoting} from "../contracts/AnonVoting.sol";
import {HonkVerifier, IVerifier} from "../contracts/verifier/HonkVerifier.sol";

/// @notice Stands the whole system up on a local chain and wires it together.
///
///   MembershipNFT  <-- VoterRegistry  <-- AnonVoting --> HonkVerifier
///
/// Wiring is constructor-only and immutable: there is no setVerifier(), so the DAO admin
/// cannot swap in a permissive verifier after the fact and forge a tally. Deliberately there
/// is no mock verifier anywhere in this path — the real generated verifier is the only one.
///
/// Also mints the DAO's membership badges, so the local chain has a realistic electorate.
/// It does NOT insert any voter commitments: only a member can do that, from their own
/// wallet, because only they know their secret. See js/join.mjs.
contract Deploy is Script {
    /// Anvil's default mnemonic. Members are HD indices 0..MEMBER_COUNT-1.
    string internal constant DEFAULT_MNEMONIC = "test test test test test test test test test test test junk";

    function run() external {
        string memory mnemonic = vm.envOr("MNEMONIC", DEFAULT_MNEMONIC);
        uint256 memberCount = vm.envOr("MEMBER_COUNT", uint256(150));

        uint256 deployerKey = vm.deriveKey(mnemonic, 0);
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        MembershipNFT membership = new MembershipNFT(deployer);
        VoterRegistry registry = new VoterRegistry(membership);
        HonkVerifier verifier = new HonkVerifier();
        AnonVoting voting = new AnonVoting(IVerifier(address(verifier)), registry);

        for (uint256 i = 0; i < memberCount; i++) {
            membership.mint(vm.addr(vm.deriveKey(mnemonic, uint32(i))));
        }

        vm.stopBroadcast();

        require(address(voting.registry()) == address(registry), "voting -> registry");
        require(address(voting.membership()) == address(membership), "voting -> membership");
        require(address(voting.verifier()) == address(verifier), "voting -> verifier");
        require(membership.totalSupply() == memberCount, "badge count");

        console2.log("MembershipNFT ", address(membership));
        console2.log("VoterRegistry ", address(registry));
        console2.log("HonkVerifier  ", address(verifier));
        console2.log("AnonVoting    ", address(voting));
        console2.log("members minted", memberCount);

        _write(address(membership), address(registry), address(verifier), address(voting), memberCount);
    }

    function _write(address membership, address registry, address verifier, address voting, uint256 memberCount)
        internal
    {
        // deployments/ is gitignored, so on a fresh clone it does not exist yet and
        // vm.writeJson would fail with a bare "No such file or directory".
        if (!vm.isDir("./deployments")) vm.createDir("./deployments", true);

        string memory obj = "deployment";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeUint(obj, "deployBlock", block.number);
        vm.serializeUint(obj, "memberCount", memberCount);
        vm.serializeAddress(obj, "membershipNFT", membership);
        vm.serializeAddress(obj, "voterRegistry", registry);
        vm.serializeAddress(obj, "honkVerifier", verifier);
        string memory json = vm.serializeAddress(obj, "anonVoting", voting);
        vm.writeJson(json, "./deployments/local.json");
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";

import {Ballot} from "../src/Ballot.sol";
import {IMembership, MemberRegistry} from "../src/MemberRegistry.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {IVerifier} from "../src/verifiers/HonkVerifierBase.sol";
import {RegisterVerifier} from "../src/verifiers/RegisterVerifier.sol";
import {VoteVerifier} from "../src/verifiers/VoteVerifier.sol";

/// @notice Stands the whole system up on a local chain and wires it together.
///
///   forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
///
/// Writes deployments/<chainid>.json, which the Node scripts in js/ read.
contract Deploy is Script {
    /// anvil's default mnemonic — the 150 "member wallets" are derived from it.
    string constant MNEMONIC = "test test test test test test test test test test test junk";

    function run() external {
        uint32 memberCount = uint32(vm.envOr("MEMBER_COUNT", uint256(150)));
        uint32 minAnonymitySet = uint32(vm.envOr("MIN_ANONYMITY_SET", uint256(8)));
        uint64 minVotingPeriod = uint64(vm.envOr("MIN_VOTING_PERIOD", uint256(10 minutes)));
        uint256 daoKey = vm.envOr("DAO_PRIVATE_KEY", vm.deriveKey(MNEMONIC, 0));

        vm.startBroadcast(daoKey);

        // 1. The public side of the DAO: who is allowed to vote at all.
        MembershipNFT nft = new MembershipNFT("DAO Membership", "DAOM");

        // 2. Two UltraHonk verifiers, one per circuit. They hold no state and
        //    trust nothing; each is pinned to one circuit's verification key.
        RegisterVerifier registerVerifier = new RegisterVerifier();
        VoteVerifier voteVerifier = new VoteVerifier();

        // 3. The anonymity set. Wired to the NFT (who may join) and to the
        //    register verifier (how the Merkle root is kept honest).
        MemberRegistry registry = new MemberRegistry(IMembership(address(nft)), IVerifier(address(registerVerifier)));

        // 4. The ballot box. Wired to the registry (where roots come from),
        //    the NFT (who may open a proposal) and the vote verifier.
        Ballot ballot = new Ballot(
            registry, IMembership(address(nft)), IVerifier(address(voteVerifier)), minAnonymitySet, minVotingPeriod
        );

        // 5. Hand every member their (public, soulbound) membership token.
        for (uint32 i = 0; i < memberCount; i++) {
            nft.mint(vm.addr(vm.deriveKey(MNEMONIC, i)));
        }

        vm.stopBroadcast();

        _write(address(nft), address(registry), address(ballot), address(registerVerifier), address(voteVerifier));

        console.log("MembershipNFT   ", address(nft));
        console.log("RegisterVerifier", address(registerVerifier));
        console.log("VoteVerifier    ", address(voteVerifier));
        console.log("MemberRegistry  ", address(registry));
        console.log("Ballot          ", address(ballot));
        console.log("members minted  ", memberCount);
    }

    function _write(address nft, address registry, address ballot, address registerVerifier, address voteVerifier)
        internal
    {
        string memory obj = "deployment";
        vm.serializeAddress(obj, "membershipNFT", nft);
        vm.serializeAddress(obj, "memberRegistry", registry);
        vm.serializeAddress(obj, "registerVerifier", registerVerifier);
        vm.serializeAddress(obj, "voteVerifier", voteVerifier);
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeUint(obj, "deployBlock", block.number);
        string memory out = vm.serializeAddress(obj, "ballot", ballot);
        vm.writeJson(out, string.concat("./deployments/", vm.toString(block.chainid), ".json"));
    }
}

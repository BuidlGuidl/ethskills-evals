// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {HonkVerifier} from "../src/HonkVerifier.sol";
import {PoseidonT3Hasher} from "../src/PoseidonT3Hasher.sol";
import {MemberRegistry} from "../src/MemberRegistry.sol";
import {AnonymousBallot} from "../src/AnonymousBallot.sol";
import {MembershipNFT} from "../src/demo/MembershipNFT.sol";
import {IPoseidonT3} from "../src/interfaces/IPoseidonT3.sol";
import {IMembershipNFT} from "../src/interfaces/IMembershipNFT.sol";
import {IVerifier} from "../src/interfaces/IVerifier.sol";

/// @notice Stands the whole system up on a local chain and wires it together.
///
///   forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast \
///     --private-key <deployer>
///
/// Writes deployments/<chainid>.json, which the client scripts read.
///
/// MEMBERSHIP_NFT can be set to an existing collection; otherwise the demo NFT in
/// src/demo is deployed so there is something to own. HonkVerifier is the real
/// generated verifier -- there is no mock in this path, on purpose.
contract Deploy is Script {
    function run() external {
        uint32 minAnonymitySet = uint32(vm.envOr("MIN_ANONYMITY_SET", uint256(50)));
        address existingNft = vm.envOr("MEMBERSHIP_NFT", address(0));

        vm.startBroadcast();
        address deployer = msg.sender;

        IMembershipNFT membershipNFT;
        if (existingNft == address(0)) {
            membershipNFT = IMembershipNFT(address(new MembershipNFT(deployer)));
        } else {
            membershipNFT = IMembershipNFT(existingNft);
        }

        PoseidonT3Hasher poseidon = new PoseidonT3Hasher();
        HonkVerifier verifier = new HonkVerifier();

        // Registry hashes the member tree with the same Poseidon the circuit uses.
        MemberRegistry registry = new MemberRegistry(IPoseidonT3(address(poseidon)), membershipNFT);

        // Ballot reads the root/member count from the registry and hands proofs to
        // the verifier. Those two addresses are immutable once set here.
        AnonymousBallot ballot = new AnonymousBallot(
            IVerifier(address(verifier)), registry, membershipNFT, minAnonymitySet
        );

        vm.stopBroadcast();

        console.log("MembershipNFT    ", address(membershipNFT));
        console.log("PoseidonT3Hasher ", address(poseidon));
        console.log("HonkVerifier     ", address(verifier));
        console.log("MemberRegistry   ", address(registry));
        console.log("AnonymousBallot  ", address(ballot));
        console.log("minAnonymitySet  ", minAnonymitySet);

        string memory obj = "deployment";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeAddress(obj, "membershipNFT", address(membershipNFT));
        vm.serializeAddress(obj, "poseidon", address(poseidon));
        vm.serializeAddress(obj, "verifier", address(verifier));
        vm.serializeAddress(obj, "registry", address(registry));
        vm.serializeAddress(obj, "ballot", address(ballot));
        vm.serializeUint(obj, "treeDepth", registry.DEPTH());
        string memory json = vm.serializeUint(obj, "minAnonymitySet", uint256(minAnonymitySet));

        string memory dir = string.concat(vm.projectRoot(), "/deployments");
        vm.createDir(dir, true);
        string memory path = string.concat(dir, "/", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);
        console.log("wrote", path);
    }
}

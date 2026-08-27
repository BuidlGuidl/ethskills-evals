// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {MemberSet} from "../src/MemberSet.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {IMembershipNFT} from "../src/IMembershipNFT.sol";
import {PrivateBallot, IHonkVerifier} from "../src/PrivateBallot.sol";
import {HonkVerifier} from "../src/verifier/HonkVerifier.sol";

/// @notice Stands the whole system up and writes the addresses where the Node
///         scripts look for them.
///
/// @dev Wiring is all constructor-time and immutable -- there is no setter for
///      the verifier or the member set. That is deliberate: an admin who could
///      repoint the verifier could accept forged ballots, and one who could
///      repoint the member set could swap in a set of leaves they control.
///      Changing either means a new deployment that everyone can see.
///
///      Set MEMBERSHIP_NFT to reuse the DAO's existing ERC-721; leave it unset
///      and a fresh MembershipNFT is deployed with the broadcaster as admin.
contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        address deployer = msg.sender;

        HonkVerifier verifier = new HonkVerifier();

        address existing = vm.envOr("MEMBERSHIP_NFT", address(0));
        IMembershipNFT membership =
            existing == address(0) ? IMembershipNFT(new MembershipNFT(deployer)) : IMembershipNFT(existing);

        MemberSet memberSet = new MemberSet(membership);
        PrivateBallot ballot = new PrivateBallot(IHonkVerifier(address(verifier)), memberSet);

        vm.stopBroadcast();

        // Sanity-check the wiring before anyone relies on it.
        require(address(ballot.verifier()) == address(verifier), "ballot -> verifier");
        require(address(ballot.memberSet()) == address(memberSet), "ballot -> memberSet");
        require(address(memberSet.membership()) == address(membership), "memberSet -> nft");
        require(address(ballot.membership()) == address(membership), "ballot -> nft");

        _write(address(verifier), address(membership), address(memberSet), address(ballot), deployer);

        console2.log("HonkVerifier  ", address(verifier));
        console2.log("MembershipNFT ", address(membership));
        console2.log("MemberSet     ", address(memberSet));
        console2.log("PrivateBallot ", address(ballot));
        console2.log("admin         ", deployer);
    }

    function _write(address verifier, address membership, address memberSet, address ballot, address admin)
        internal
    {
        string memory obj = "deployment";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeAddress(obj, "honkVerifier", verifier);
        vm.serializeAddress(obj, "membershipNFT", membership);
        vm.serializeAddress(obj, "memberSet", memberSet);
        vm.serializeAddress(obj, "admin", admin);
        string memory json = vm.serializeAddress(obj, "privateBallot", ballot);

        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);
        console2.log("wrote contracts/%s", path);
    }
}

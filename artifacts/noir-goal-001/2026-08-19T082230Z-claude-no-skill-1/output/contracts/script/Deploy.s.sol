// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {DevMembershipNFT} from "../src/dev/DevMembershipNFT.sol";
import {MemberRegistry} from "../src/MemberRegistry.sol";
import {PrivateBallot} from "../src/PrivateBallot.sol";
import {IHonkVerifier} from "../src/interfaces/IHonkVerifier.sol";
import {IMembershipNFT} from "../src/interfaces/IMembershipNFT.sol";
import {JoinVerifierHonk} from "../src/verifiers/JoinVerifier.sol";
import {VoteVerifierHonk} from "../src/verifiers/VoteVerifier.sol";

/// @notice Stands the whole system up and wires it together.
///
/// Environment:
///   MEMBERSHIP_NFT  address of the DAO's existing membership NFT. If unset, a
///                   DevMembershipNFT is deployed and `MEMBER_COUNT` tokens are
///                   minted to the first accounts of `MNEMONIC` - local only.
///   MEMBER_COUNT    tokens to mint when using the dev NFT (default 150).
///   MNEMONIC        mnemonic those tokens are minted to (default: anvil's).
///
/// Writes deployments/<chainid>.json for the Node scripts to read.
contract Deploy is Script {
    string constant ANVIL_MNEMONIC = "test test test test test test test test test test test junk";

    function run() external {
        vm.startBroadcast();

        IMembershipNFT membershipNFT = _resolveMembershipNFT();

        // Verifiers first: the registry and the ballot box are immutable in
        // their verifier, so a circuit change means redeploying both.
        IHonkVerifier joinVerifier = IHonkVerifier(address(new JoinVerifierHonk()));
        IHonkVerifier voteVerifier = IHonkVerifier(address(new VoteVerifierHonk()));

        MemberRegistry registry = new MemberRegistry(membershipNFT, joinVerifier);
        PrivateBallot ballot = new PrivateBallot(registry, voteVerifier);

        vm.stopBroadcast();

        require(registry.root() == registry.EMPTY_ROOT(), "registry did not start empty");

        console.log("membershipNFT ", address(membershipNFT));
        console.log("joinVerifier  ", address(joinVerifier));
        console.log("voteVerifier  ", address(voteVerifier));
        console.log("memberRegistry", address(registry));
        console.log("privateBallot ", address(ballot));

        _writeDeployment(address(membershipNFT), address(joinVerifier), address(voteVerifier), address(registry), address(ballot));
    }

    /// @dev Uses the DAO's real NFT when given one; otherwise mints a local set.
    function _resolveMembershipNFT() private returns (IMembershipNFT) {
        address existing = vm.envOr("MEMBERSHIP_NFT", address(0));
        if (existing != address(0)) {
            console.log("using existing membership NFT", existing);
            return IMembershipNFT(existing);
        }

        uint256 memberCount = vm.envOr("MEMBER_COUNT", uint256(150));
        string memory mnemonic = vm.envOr("MNEMONIC", ANVIL_MNEMONIC);

        DevMembershipNFT nft = new DevMembershipNFT(msg.sender);
        for (uint32 i = 0; i < memberCount; i++) {
            nft.mint(vm.addr(vm.deriveKey(mnemonic, i)));
        }
        console.log("minted dev membership tokens:", memberCount);
        return IMembershipNFT(address(nft));
    }

    function _writeDeployment(
        address membershipNFT,
        address joinVerifier,
        address voteVerifier,
        address registry,
        address ballot
    ) private {
        string memory json = "deployment";
        vm.serializeUint(json, "chainId", block.chainid);
        vm.serializeAddress(json, "membershipNFT", membershipNFT);
        vm.serializeAddress(json, "joinVerifier", joinVerifier);
        vm.serializeAddress(json, "voteVerifier", voteVerifier);
        vm.serializeAddress(json, "memberRegistry", registry);
        string memory out = vm.serializeAddress(json, "privateBallot", ballot);

        string memory path = string.concat(vm.projectRoot(), "/../deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(out, path);
        console.log("wrote", path);
    }
}

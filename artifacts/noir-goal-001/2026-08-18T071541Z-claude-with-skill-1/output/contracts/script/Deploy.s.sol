// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {AnonVoting} from "../src/AnonVoting.sol";
import {MemberRegistry} from "../src/MemberRegistry.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {IVerifier} from "../src/IVerifier.sol";
import {HonkVerifier} from "../src/verifiers/HonkVerifier.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @notice Stand the system up on a local chain.
///
///   anvil &
///   forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
///
/// Deploys four contracts and wires them: HonkVerifier and MemberRegistry are constructor
/// arguments to AnonVoting; MembershipNFT is a constructor argument to MemberRegistry. Nothing is
/// upgradeable and nothing is settable afterwards — the wiring is immutable on purpose, so there
/// is no admin key that could swap in a verifier that accepts forged ballots.
///
/// It also mints one membership NFT to each of 150 accounts derived from the anvil mnemonic and
/// tops them up with gas, so the local DAO has a realistic anonymity set. Registration is *not*
/// done here: each member registers their own commitment from their own wallet
/// (`npm run register`), which is how it works in production too.
contract Deploy is Script {
    uint256 public constant MEMBER_COUNT = 150;
    string constant MNEMONIC = "test test test test test test test test test test test junk";
    /// Enough for a registration transaction with generous headroom, and small enough that
    /// topping up 150 members plus a relayer works on an anvil started with modest balances.
    /// Override with MEMBER_GAS_TOPUP_WEI.
    uint256 immutable memberGasTopup = vm.envOr("MEMBER_GAS_TOPUP_WEI", uint256(0.02 ether));

    function run() external {
        uint256 deployerKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.deriveKey(MNEMONIC, 0));
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        MembershipNFT nft = new MembershipNFT(deployer);
        HonkVerifier verifier = new HonkVerifier();
        MemberRegistry registry = new MemberRegistry(IERC721(address(nft)));
        AnonVoting voting = new AnonVoting(IVerifier(address(verifier)), registry);

        // Member i (0-based) is anvil account i+1 and receives membership NFT id i+1.
        address[] memory members = new address[](MEMBER_COUNT);
        for (uint256 i = 0; i < MEMBER_COUNT; i++) {
            members[i] = vm.addr(vm.deriveKey(MNEMONIC, uint32(i + 1)));
        }
        nft.mintBatch(members);

        // The relayer that will forward anonymous ballots. Just an ordinary funded account with no
        // membership NFT and no registration.
        address relayer = vm.addr(vm.deriveKey(MNEMONIC, uint32(MEMBER_COUNT + 1)));

        // Top up anyone the chain did not pre-fund. `anvil --accounts 152` covers everyone, in
        // which case this loop sends nothing at all.
        for (uint256 i = 0; i < MEMBER_COUNT; i++) {
            if (members[i].balance < memberGasTopup) payable(members[i]).transfer(memberGasTopup - members[i].balance);
        }
        if (relayer.balance < memberGasTopup) payable(relayer).transfer(memberGasTopup - relayer.balance);

        vm.stopBroadcast();

        _writeDeployment(nft, verifier, registry, voting, relayer);

        console.log("MembershipNFT ", address(nft));
        console.log("HonkVerifier  ", address(verifier));
        console.log("MemberRegistry", address(registry));
        console.log("AnonVoting    ", address(voting));
        console.log("relayer       ", relayer);
        console.log("members minted", MEMBER_COUNT);
    }

    function _writeDeployment(
        MembershipNFT nft,
        HonkVerifier verifier,
        MemberRegistry registry,
        AnonVoting voting,
        address relayer
    ) internal {
        string memory obj = "deployment";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeUint(obj, "deployBlock", block.number);
        vm.serializeUint(obj, "memberCount", MEMBER_COUNT);
        vm.serializeAddress(obj, "membershipNFT", address(nft));
        vm.serializeAddress(obj, "honkVerifier", address(verifier));
        vm.serializeAddress(obj, "memberRegistry", address(registry));
        vm.serializeAddress(obj, "relayer", relayer);
        string memory json = vm.serializeAddress(obj, "anonVoting", address(voting));
        vm.createDir("./deployments", true);
        vm.writeJson(json, "./deployments/local.json");
    }
}

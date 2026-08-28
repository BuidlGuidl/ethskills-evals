// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {HonkVerifier} from "../src/verifiers/HonkVerifier.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";
import {AnonVoting} from "../src/AnonVoting.sol";

/// @notice Stands the whole system up on a local chain and wires it together:
///
///   PoseidonT3 (auto-deployed + linked by forge)
///        ^ used by
///   AnonVoting --verifier--> HonkVerifier   (generated from circuits/ballot)
///              --membership--> MembershipNFT (stand-in for the DAO's real NFT)
///
/// Writes deployments/local.json for the Node scripts to pick up.
///
///   forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
///
/// Env:
///   PRIVATE_KEY        deployer key (default: anvil account 0)
///   MEMBER_COUNT       how many anvil accounts to mint membership to (default 8)
///   MIN_ANONYMITY_SET  smallest member set a proposal may open against (default 8)
///   MEMBERSHIP_NFT     reuse an existing membership NFT instead of deploying one
contract Deploy is Script {
    uint256 constant ANVIL_KEY_0 = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    string constant ANVIL_MNEMONIC = "test test test test test test test test test test test junk";

    function run() external {
        uint256 deployerKey = vm.envOr("PRIVATE_KEY", ANVIL_KEY_0);
        uint256 memberCount = vm.envOr("MEMBER_COUNT", uint256(8));
        uint256 minAnonymitySet = vm.envOr("MIN_ANONYMITY_SET", uint256(8));
        address existingNft = vm.envOr("MEMBERSHIP_NFT", address(0));
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        HonkVerifier verifier = new HonkVerifier();

        MembershipNFT nft;
        if (existingNft == address(0)) {
            nft = new MembershipNFT(deployer);
            // Anvil accounts 1..memberCount become DAO members. Account 0 is the
            // deployer/admin; the last account is left unregistered so it can act
            // as the ballot relayer (castVote rejects registered member wallets).
            for (uint256 i = 1; i <= memberCount; i++) {
                nft.mint(vm.addr(vm.deriveKey(ANVIL_MNEMONIC, uint32(i))));
            }
        } else {
            nft = MembershipNFT(existingNft);
        }

        AnonVoting voting = new AnonVoting(address(verifier), address(nft), minAnonymitySet);

        vm.stopBroadcast();

        console.log("HonkVerifier ", address(verifier));
        console.log("MembershipNFT", address(nft));
        console.log("AnonVoting   ", address(voting));
        console.log("members minted", existingNft == address(0) ? memberCount : 0);

        string memory json = string.concat(
            "{\n",
            '  "chainId": ',
            vm.toString(block.chainid),
            ",\n",
            '  "anonVoting": "',
            vm.toString(address(voting)),
            '",\n',
            '  "membershipNFT": "',
            vm.toString(address(nft)),
            '",\n',
            '  "honkVerifier": "',
            vm.toString(address(verifier)),
            '",\n',
            '  "deployBlock": ',
            vm.toString(block.number),
            ",\n",
            '  "memberCount": ',
            vm.toString(memberCount),
            "\n}\n"
        );
        vm.writeFile("../deployments/local.json", json);
        console.log("wrote deployments/local.json");
    }
}

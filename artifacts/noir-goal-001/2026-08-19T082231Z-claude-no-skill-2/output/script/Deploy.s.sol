// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {CheatsUser, console} from "./Cheats.sol";
import {MembershipNFT} from "../src/demo/MembershipNFT.sol";
import {MemberRegistry, IMembershipNFT} from "../src/MemberRegistry.sol";
import {PrivateBallot, IHonkVerifier} from "../src/PrivateBallot.sol";
import {HonkVerifier} from "../src/verifiers/HonkVerifier.sol";

/// @notice Stands the whole system up on a local chain and wires it together.
///
///   MembershipNFT  <-- MemberRegistry (gate: who may register a voting key)
///   MemberRegistry <-- PrivateBallot  (source of the pinned member tree root)
///   HonkVerifier   <-- PrivateBallot  (checks every ballot proof)
///
/// Wiring is via constructor immutables, so there is no post-deploy `setX` step and
/// nothing an admin can re-point later.
///
/// Usage:
///   forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 --broadcast
///
/// Env:
///   DEPLOYER_PK  deployer / NFT admin key (default: anvil account 0)
///   MEMBER_COUNT how many demo membership NFTs to mint to anvil accounts 1..N
///                (default 8). In production you skip this and pass NFT_ADDRESS.
///   NFT_ADDRESS  use an existing membership NFT instead of deploying the demo one.
contract Deploy is CheatsUser {
    /// anvil's deterministic mnemonic keys, accounts 0..9.
    uint256 constant ANVIL_PK_0 = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    function run() external {
        uint256 deployerPk = vm.envOr("DEPLOYER_PK", ANVIL_PK_0);
        address deployer = vm.addr(deployerPk);
        uint256 memberCount = vm.envOr("MEMBER_COUNT", uint256(8));
        address existingNft = _envAddressOr("NFT_ADDRESS", address(0));

        vm.startBroadcast(deployerPk);

        MembershipNFT nft;
        if (existingNft == address(0)) {
            nft = new MembershipNFT(deployer);
            for (uint256 i = 0; i < memberCount; i++) {
                nft.mint(vm.addr(_anvilKey(i + 1)));
            }
        } else {
            nft = MembershipNFT(existingNft);
        }

        HonkVerifier verifier = new HonkVerifier();
        MemberRegistry registry = new MemberRegistry(IMembershipNFT(address(nft)));
        PrivateBallot ballot = new PrivateBallot(registry, IHonkVerifier(address(verifier)));

        vm.stopBroadcast();

        console.log("MembershipNFT ", address(nft));
        console.log("HonkVerifier  ", address(verifier));
        console.log("MemberRegistry", address(registry));
        console.log("PrivateBallot ", address(ballot));

        string memory obj = "deployment";
        vm.serializeAddress(obj, "membershipNFT", address(nft));
        vm.serializeAddress(obj, "honkVerifier", address(verifier));
        vm.serializeAddress(obj, "memberRegistry", address(registry));
        vm.serializeAddress(obj, "deployer", deployer);
        vm.serializeUint(obj, "memberCount", memberCount);
        string memory json = vm.serializeAddress(obj, "privateBallot", address(ballot));

        string memory outPath = vm.envOr("DEPLOYMENT_OUT", string("deployments/local.json"));
        vm.writeJson(json, outPath);
        console.log("wrote deployment file");
    }

    function _envAddressOr(string memory name, address fallbackValue) internal view returns (address) {
        return address(uint160(vm.envOr(name, uint256(uint160(fallbackValue)))));
    }

    /// @dev Private keys for anvil accounts under the default mnemonic. Hardcoded
    ///      because they are public test keys and this path is local-chain only.
    function _anvilKey(uint256 index) internal pure returns (uint256) {
        uint256[10] memory keys = [
            0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80,
            0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d,
            0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a,
            0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6,
            0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a,
            0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba,
            0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e,
            0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356,
            0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97,
            0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6
        ];
        require(index < 10, "anvil key index out of range");
        return keys[index];
    }
}

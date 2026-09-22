// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SaveVault} from "./SaveVault.sol";

/// @title SaveVaultFactory
/// @notice Permissionless registry and deployer: one canonical `SaveVault` per ERC-20.
/// @dev The factory is deliberately inert. It holds no funds, no allowances and no privileges
///      over the vaults it deploys, and it has no owner. Listing a hostile token here can
///      therefore only endanger people who choose to deposit into *that* token's vault — there
///      is no shared state for one vault to reach through.
///
///      Vaults are deployed with CREATE2 salted by the asset address, so the vault address is
///      derivable off-chain before deployment and is stable across chains for the same
///      factory bytecode. The registry rejects duplicates, so "the vault for token X" is a
///      single well-defined address rather than a set of look-alikes competing for deposits.
contract SaveVaultFactory {
    /// @notice asset => canonical vault. Zero address means not listed yet.
    mapping(address asset => address vault) public vaultFor;

    /// @notice Every vault ever created, in creation order.
    address[] public allVaults;

    error VaultAlreadyExists(address asset, address vault);
    error ZeroAddress();

    event VaultCreated(address indexed asset, address indexed vault, uint256 index);

    /// @notice Deploys the vault for `asset`. Anyone may call this, once per asset.
    function createVault(address asset) external returns (address vault) {
        if (asset == address(0)) revert ZeroAddress();

        address existing = vaultFor[asset];
        if (existing != address(0)) revert VaultAlreadyExists(asset, existing);

        // `SaveVault`'s constructor rejects non-contract assets and unusable decimals, and
        // reads the token's metadata with gas-capped staticcalls, so a hostile token can fail
        // its own listing but cannot make this call behave unexpectedly.
        vault = address(new SaveVault{salt: bytes32(uint256(uint160(asset)))}(asset));

        vaultFor[asset] = vault;
        allVaults.push(vault);
        emit VaultCreated(asset, vault, allVaults.length - 1);
    }

    function vaultCount() external view returns (uint256) {
        return allVaults.length;
    }

    /// @notice The address `createVault(asset)` would deploy to.
    function predictVaultAddress(address asset) external view returns (address) {
        bytes32 initCodeHash = keccak256(abi.encodePacked(type(SaveVault).creationCode, abi.encode(asset)));
        return address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            bytes1(0xff), address(this), bytes32(uint256(uint160(asset))), initCodeHash
                        )
                    )
                )
            )
        );
    }
}

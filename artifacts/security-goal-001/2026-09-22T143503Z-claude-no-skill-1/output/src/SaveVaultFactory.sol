// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SaveVault} from "./SaveVault.sol";

/// @title SaveVaultFactory
/// @notice Permissionless registry: anyone can list any ERC-20 and get exactly one canonical vault
///         for it. The factory holds no funds, has no owner and grants itself no power over the
///         vaults it deploys.
/// @dev The one-vault-per-token rule exists for safety, not tidiness. Multiple vaults over the same
///      token would let a griefer deploy a look-alike with a deceptive name, and would split
///      liquidity across addresses that all render identically in a UI. `vaultFor` is the only
///      mapping an integrator should trust; the CREATE2 salt makes the address verifiable offchain.
contract SaveVaultFactory {
    /// @notice Canonical vault for a given underlying, or `address(0)` if not yet listed.
    mapping(address underlying => address vault) public vaultFor;

    /// @notice Every vault ever created, in listing order.
    address[] public allVaults;

    event VaultCreated(address indexed underlying, address indexed vault, uint256 index);

    error ZeroAddress();
    error NotAContract(address underlying);
    error AlreadyListed(address underlying, address vault);

    /// @notice Deploys the vault for `underlying`. Callable by anyone, exactly once per token.
    function createVault(address underlying) external returns (address vault) {
        if (underlying == address(0)) revert ZeroAddress();
        // A codeless address would make `transfer` a no-op that "succeeds", so a vault over one
        // would mint shares against nothing. SafeERC20 also rejects it at runtime; reject it here
        // so the bad vault never exists to be linked to.
        if (underlying.code.length == 0) revert NotAContract(underlying);

        address existing = vaultFor[underlying];
        if (existing != address(0)) revert AlreadyListed(underlying, existing);

        // Deterministic address: salt is the token, so anyone can verify the vault offchain without
        // trusting this registry's storage.
        vault = address(new SaveVault{salt: _salt(underlying)}(underlying));

        vaultFor[underlying] = vault;
        allVaults.push(vault);
        emit VaultCreated(underlying, vault, allVaults.length - 1);
    }

    /// @notice Address `createVault(underlying)` will produce.
    function predictVault(address underlying) external view returns (address) {
        bytes32 initCodeHash =
            keccak256(abi.encodePacked(type(SaveVault).creationCode, abi.encode(underlying)));
        return address(
            uint160(
                uint256(
                    keccak256(abi.encodePacked(bytes1(0xff), address(this), _salt(underlying), initCodeHash))
                )
            )
        );
    }

    function vaultCount() external view returns (uint256) {
        return allVaults.length;
    }

    function _salt(address underlying) private pure returns (bytes32) {
        return bytes32(uint256(uint160(underlying)));
    }
}

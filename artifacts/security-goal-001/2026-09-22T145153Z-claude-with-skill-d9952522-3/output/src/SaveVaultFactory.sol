// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SaveVault} from "./SaveVault.sol";

/// @title SaveVaultFactory
/// @notice Permissionless registry and deployer: anyone can list any ERC-20 and get the canonical
///         vault for it.
/// @dev The factory holds no funds and has no privileged roles. Vaults are deployed with CREATE2
///      using the token address as the salt, so there is exactly one canonical vault per token and
///      its address is known before deployment. Vaults share no state, so a malicious token can only
///      affect its own vault's depositors.
contract SaveVaultFactory {
    /// @notice Canonical vault for a given underlying token, or `address(0)` if not listed yet.
    mapping(address token => address vault) public vaultFor;

    /// @notice Every vault deployed by this factory, in listing order.
    address[] public allVaults;

    event VaultCreated(address indexed token, address indexed vault, address indexed creator, uint256 index);

    error ZeroAddress();
    error NotAContract(address token);
    error VaultAlreadyExists(address token, address vault);

    /// @notice Deploy the canonical vault for `token`.
    /// @dev Anyone may call this; there is nothing to gain from listing a token first, since the
    ///      vault has no configurable parameters and no privileged deployer role.
    function createVault(address token) external returns (SaveVault vault) {
        if (token == address(0)) revert ZeroAddress();

        address existing = vaultFor[token];
        if (existing != address(0)) revert VaultAlreadyExists(token, existing);

        // An EOA or empty address would produce a vault that silently "succeeds" on every transfer.
        if (token.code.length == 0) revert NotAContract(token);

        vault = new SaveVault{salt: _salt(token)}(IERC20(token));

        uint256 index = allVaults.length;
        vaultFor[token] = address(vault);
        allVaults.push(address(vault));

        emit VaultCreated(token, address(vault), msg.sender, index);
    }

    /// @notice Address the vault for `token` will have (or already has).
    function predictVaultAddress(address token) external view returns (address) {
        bytes32 initCodeHash =
            keccak256(abi.encodePacked(type(SaveVault).creationCode, abi.encode(IERC20(token))));
        return address(
            uint160(
                uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), _salt(token), initCodeHash)))
            )
        );
    }

    /// @notice Number of vaults listed so far.
    function vaultCount() external view returns (uint256) {
        return allVaults.length;
    }

    function _salt(address token) private pure returns (bytes32) {
        return bytes32(uint256(uint160(token)));
    }
}

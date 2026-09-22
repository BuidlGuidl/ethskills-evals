// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SaveVault} from "./SaveVault.sol";
import {SafeTokenMetadata} from "./lib/SafeTokenMetadata.sol";

/// @title SaveVaultFactory
/// @notice Permissionless registry: anyone can list any ERC-20 and get the canonical vault for it.
///
/// @dev The factory is deliberately stateless with respect to value — it never holds, approves or
///      moves tokens, so a malicious listing cannot reach any other vault's funds. Each vault is a
///      separate contract holding exactly one asset, which is what keeps the blast radius of a
///      hostile token confined to the people who chose to deposit into that token's vault.
///
///      One vault per token, deployed with CREATE2 at a deterministic address. That matters for a
///      permissionless registry: without it an attacker could stand up a second, look-alike vault
///      for a popular token and farm deposits from anyone resolving "the USDC vault" by name.
contract SaveVaultFactory {
    /// @notice Canonical vault for each underlying token. Zero until listed.
    mapping(address token => address vault) public vaultFor;
    /// @notice Every vault ever created, in listing order.
    address[] public allVaults;

    event VaultCreated(address indexed token, address indexed vault, address indexed creator);

    error TokenNotContract();
    error VaultAlreadyExists(address vault);

    /// @notice List `token` and deploy its vault. Callable by anyone, exactly once per token.
    /// @dev No allowlist, by product design. The only checks are the ones that would otherwise
    ///      produce a broken vault: a non-contract address (a typo'd or not-yet-deployed token
    ///      would make every `transfer` a silent no-op success, and the vault would report a real
    ///      balance of zero forever) and a duplicate listing.
    function createVault(address token) external returns (address vault) {
        if (token.code.length == 0) revert TokenNotContract();

        address existing = vaultFor[token];
        if (existing != address(0)) revert VaultAlreadyExists(existing);

        (string memory name, string memory symbol) = _receiptMetadata(token);

        vault = address(new SaveVault{salt: _salt(token)}(IERC20(token), name, symbol));

        vaultFor[token] = vault;
        allVaults.push(vault);

        emit VaultCreated(token, vault, msg.sender);
    }

    /// @notice Address `token`'s vault will occupy (or already occupies).
    function computeVaultAddress(address token) external view returns (address) {
        (string memory name, string memory symbol) = _receiptMetadata(token);
        bytes32 initCodeHash =
            keccak256(abi.encodePacked(type(SaveVault).creationCode, abi.encode(IERC20(token), name, symbol)));
        return address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), _salt(token), initCodeHash))))
        );
    }

    function vaultCount() external view returns (uint256) {
        return allVaults.length;
    }

    /// @dev Metadata is copied from the underlying purely for display, through a library that
    ///      treats the token as hostile. Nothing on-chain depends on these strings, so a token
    ///      that lies about its name affects labels only — never accounting. Callers should still
    ///      resolve vaults through {vaultFor}, not by matching symbols.
    function _receiptMetadata(address token) private view returns (string memory name, string memory symbol) {
        name = string.concat("Save ", SafeTokenMetadata.safeName(token));
        symbol = string.concat("sv", SafeTokenMetadata.safeSymbol(token));
    }

    function _salt(address token) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(token));
    }
}

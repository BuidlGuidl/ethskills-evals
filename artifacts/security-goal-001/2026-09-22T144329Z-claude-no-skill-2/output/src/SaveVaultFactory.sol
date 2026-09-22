// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {SaveVault} from "./SaveVault.sol";
import {TokenMetadata} from "./libraries/TokenMetadata.sol";

/// @title SaveVaultFactory
/// @notice Permissionless registry + deployer: anyone can list any ERC-20 and
///         get the one canonical vault for it.
/// @dev The factory cannot vouch for a token. It only enforces the properties
///      the vault's accounting depends on (callable `balanceOf`, sane
///      `decimals()`), and guarantees at most one vault per token address so
///      the front end never has to choose between look-alike vaults.
///      Everything else — is this token honest, does it rebase, is it a
///      look-alike of a real asset — is a listing decision, not an onchain one.
contract SaveVaultFactory {
    using TokenMetadata for address;

    /// @dev Share decimals are asset decimals + SaveVault.DECIMALS_OFFSET, and
    ///      the share math multiplies supply by a balance. Capping asset
    ///      decimals keeps those products far away from 2**256 and rejects the
    ///      joke tokens that report absurd values.
    uint8 public constant MAX_ASSET_DECIMALS = 24;

    /// @notice token => its canonical vault (address(0) if unlisted).
    mapping(address token => address vault) public vaultFor;

    /// @notice Every vault ever created, in listing order.
    address[] public allVaults;

    event VaultCreated(address indexed token, address indexed vault, address indexed lister);

    error NotAContract(address token);
    error VaultAlreadyExists(address token, address vault);
    error UnreadableDecimals(address token);
    error DecimalsTooLarge(address token, uint8 decimals);
    error BalanceOfUnavailable(address token);

    function vaultCount() external view returns (uint256) {
        return allVaults.length;
    }

    /// @notice Deploy the canonical vault for `token`.
    /// @dev CREATE2 with the token as salt: the vault address is predictable
    ///      offchain and a second listing of the same token is impossible even
    ///      if the registry mapping were somehow bypassed.
    function createVault(address token) external returns (address vault) {
        address existing = vaultFor[token];
        if (existing != address(0)) revert VaultAlreadyExists(token, existing);
        if (token.code.length == 0) revert NotAContract(token);

        (bool ok, uint8 dec) = token.tryDecimals();
        if (!ok) revert UnreadableDecimals(token);
        if (dec > MAX_ASSET_DECIMALS) revert DecimalsTooLarge(token, dec);

        // The whole accounting model is balance-based; a token whose balanceOf
        // is not a plain uint256 read would break every conversion.
        _requireBalanceOf(token);

        string memory sym = token.symbolOr("TKN");
        vault = address(
            new SaveVault{salt: bytes32(uint256(uint160(token)))}(
                token, string.concat("Saved ", sym), string.concat("sv", sym), dec
            )
        );

        vaultFor[token] = vault;
        allVaults.push(vault);
        emit VaultCreated(token, vault, msg.sender);
    }

    /// @notice The address `createVault(token)` would deploy to.
    function predictVault(address token) external view returns (address) {
        // Not precomputable without the constructor args (which depend on the
        // token's own metadata), so mirror the encoding used above.
        (bool ok, uint8 dec) = token.tryDecimals();
        if (!ok) revert UnreadableDecimals(token);
        string memory sym = token.symbolOr("TKN");
        bytes32 initCodeHash = keccak256(
            abi.encodePacked(
                type(SaveVault).creationCode,
                abi.encode(token, string.concat("Saved ", sym), string.concat("sv", sym), dec)
            )
        );
        return address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(bytes1(0xff), address(this), bytes32(uint256(uint160(token))), initCodeHash)
                    )
                )
            )
        );
    }

    function _requireBalanceOf(address token) private view {
        (bool success, bytes memory data) =
            token.staticcall{gas: 50_000}(abi.encodeWithSignature("balanceOf(address)", address(this)));
        if (!success || data.length != 32) revert BalanceOfUnavailable(token);
    }
}

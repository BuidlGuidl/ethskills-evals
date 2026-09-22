// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {SavingsVault} from "./SavingsVault.sol";

/**
 * @title SavingsVaultFactory
 * @notice Permissionless registry + deployer: one canonical vault per ERC-20.
 *
 * @dev The factory is deliberately powerless. It holds no funds, has no owner, and cannot
 *      touch a vault once deployed. Its only jobs are:
 *
 *        - deploy at most ONE vault per token, at a CREATE2 address derived from the token,
 *          so integrators and frontends have a single canonical answer to "which vault is
 *          the real one for token X" and scam look-alikes cannot squat the registry;
 *        - refuse addresses that are not plausibly ERC-20s;
 *        - emit the listing event that indexers key off.
 *
 *      Being listed here is NOT an endorsement. Anyone can list anything. The metadata
 *      below is copied from the token itself and is therefore attacker-controlled — see
 *      NOTES.md before rendering it in a UI.
 */
contract SavingsVaultFactory {
    /// @notice token => canonical vault. Zero if not listed.
    mapping(address token => address vault) public vaultFor;

    /// @notice vault => true, for cheap provenance checks by integrators.
    mapping(address vault => bool) public isVault;

    /// @notice Every vault ever deployed by this factory, in listing order.
    address[] public allVaults;

    event VaultCreated(address indexed token, address indexed vault, address indexed creator);

    error ZeroAddress();
    error TokenNotAContract(address token);
    error NotAnERC20(address token);
    error VaultAlreadyExists(address token, address vault);

    function vaultCount() external view returns (uint256) {
        return allVaults.length;
    }

    /**
     * @notice List `token` by deploying its canonical vault.
     * @dev Permissionless and idempotent-by-revert: a second call for the same token
     *      reverts with the existing vault address rather than deploying a duplicate.
     */
    function createVault(address token) external returns (address vault) {
        if (token == address(0)) revert ZeroAddress();
        if (token.code.length == 0) revert TokenNotAContract(token);

        address existing = vaultFor[token];
        if (existing != address(0)) revert VaultAlreadyExists(token, existing);

        // Minimum viability check. A vault over something that does not implement
        // balanceOf can never account for anything, so refuse to create it.
        try IERC20(token).balanceOf(address(this)) returns (uint256) {}
        catch {
            revert NotAnERC20(token);
        }

        (string memory name, string memory symbol) = _vaultMetadata(token);

        vault = address(new SavingsVault{salt: _salt(token)}(IERC20(token), name, symbol));

        // Effects before the event; nothing external is called after this point.
        vaultFor[token] = vault;
        isVault[vault] = true;
        allVaults.push(vault);

        emit VaultCreated(token, vault, msg.sender);
    }

    /// @notice Address the vault for `token` will have (or already has).
    function predictVault(address token) external view returns (address) {
        (string memory name, string memory symbol) = _vaultMetadata(token);
        return Create2.computeAddress(
            _salt(token), keccak256(abi.encodePacked(type(SavingsVault).creationCode, abi.encode(token, name, symbol)))
        );
    }

    function _salt(address token) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(token));
    }

    /**
     * @dev Builds the receipt-token name/symbol from the underlying's metadata.
     *      `symbol()` on an arbitrary token may revert (MKR returns bytes32), return an
     *      unbounded string, or be outright hostile, so the result is optional and
     *      length-capped.
     */
    function _vaultMetadata(address token) private view returns (string memory name, string memory symbol) {
        string memory underlyingSymbol = "TOKEN";
        try IERC20Metadata(token).symbol() returns (string memory s) {
            bytes memory raw = bytes(s);
            if (raw.length != 0) underlyingSymbol = _truncate(raw, 12);
        } catch {}

        name = string.concat("Saved ", underlyingSymbol);
        symbol = string.concat("sv", underlyingSymbol);
    }

    function _truncate(bytes memory raw, uint256 maxLength) private pure returns (string memory) {
        if (raw.length <= maxLength) return string(raw);
        bytes memory out = new bytes(maxLength);
        for (uint256 i = 0; i < maxLength; ++i) {
            out[i] = raw[i];
        }
        return string(out);
    }
}

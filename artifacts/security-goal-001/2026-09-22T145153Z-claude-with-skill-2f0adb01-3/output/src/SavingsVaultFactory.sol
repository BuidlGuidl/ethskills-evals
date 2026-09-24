// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SavingsVault} from "./SavingsVault.sol";
import {TokenMetadata} from "./TokenMetadata.sol";

/// @title SavingsVaultFactory
/// @notice Permissionless registry/deployer: anybody can list any ERC-20 and get a vault.
/// @dev The factory holds no funds and has no privileged role. Its only job is to make the
///      canonical vault for a token discoverable, so that the (untrusted) token cannot be
///      used to confuse the registry: exactly one vault per token address, deployed with
///      CREATE2 at an address that can be recomputed offchain before it exists.
contract SavingsVaultFactory {
    using TokenMetadata for address;

    /// @notice Bounds on the reward vesting window chosen at listing time.
    uint256 public constant MIN_REWARDS_CYCLE = 1 hours;
    uint256 public constant MAX_REWARDS_CYCLE = 30 days;

    /// @notice Canonical vault for a given underlying token (address(0) if not listed).
    mapping(address token => address vault) public vaultFor;

    /// @notice Every vault ever created, in listing order.
    address[] public allVaults;

    event VaultCreated(
        address indexed token, address indexed vault, address indexed creator, uint256 rewardsCycleLength
    );

    error ZeroAddress();
    error NotAContract();
    error VaultAlreadyExists(address vault);
    error InvalidCycleLength();

    function allVaultsLength() external view returns (uint256) {
        return allVaults.length;
    }

    /// @notice List `token` and deploy its vault.
    /// @param token The ERC-20 to save. Completely untrusted.
    /// @param rewardsCycleLength Seconds over which each keeper deposit vests into the
    ///        share price. Fixed forever for this vault.
    function createVault(address token, uint256 rewardsCycleLength) external returns (address vault) {
        if (token == address(0)) revert ZeroAddress();
        // An address with no code would make `safeTransferFrom` a silent no-op under some
        // ERC-20 helpers, and there is nothing to save anyway.
        if (token.code.length == 0) revert NotAContract();
        if (rewardsCycleLength < MIN_REWARDS_CYCLE || rewardsCycleLength > MAX_REWARDS_CYCLE) {
            revert InvalidCycleLength();
        }

        address existing = vaultFor[token];
        if (existing != address(0)) revert VaultAlreadyExists(existing);

        string memory name = string.concat("Savings ", token.safeName());
        string memory symbol = string.concat("sv", token.safeSymbol());

        vault = address(
            new SavingsVault{salt: keccak256(abi.encode(token))}(IERC20(token), name, symbol, rewardsCycleLength)
        );

        vaultFor[token] = vault;
        allVaults.push(vault);

        emit VaultCreated(token, vault, msg.sender, rewardsCycleLength);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {SaveVault} from "./SaveVault.sol";

/**
 * @title SaveVaultFactory
 * @notice Permissionless registry + deployer for {SaveVault}. Anyone can list any ERC-20; there is
 *         no allowlist, no owner and no fee. The factory's only jobs are to guarantee one canonical
 *         vault per token and to make sure a vault is never born empty.
 *
 * @dev The factory holds no funds and has no privileged functions. Listing a token here is NOT an
 *      endorsement of it — see NOTES.md for what an operator must check before listing.
 */
contract SaveVaultFactory {
    using SafeERC20 for IERC20;

    /// @notice Seed shares are minted here so they can never be redeemed.
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    /// @notice token => canonical vault.
    mapping(address token => address vault) public vaultFor;

    /// @notice Every vault ever created, in listing order.
    address[] public allVaults;

    event VaultCreated(address indexed token, address indexed vault, address indexed creator, uint256 seedAssets);

    error TokenNotAContract();
    error VaultAlreadyExists(address vault);
    error SeedRequired();

    /**
     * @notice Deploy the canonical vault for `token` and seed it.
     * @dev The seed is deposited by the factory and the resulting shares are sent to {BURN_ADDRESS},
     *      permanently. A vault therefore always has a non-zero share supply from block one, which
     *      removes the empty-vault edge case from the share-price maths entirely. Combined with the
     *      vault's internal asset accounting and its 10**6 decimals offset, this closes the
     *      first-depositor inflation attack. The seed is not recoverable by the lister — that is the
     *      point; treat it as the cost of listing.
     * @param token The underlying ERC-20.
     * @param rewardsCycleLength Seconds over which each keeper top-up vests. Immutable once set.
     * @param seedAssets Amount of `token` to seed with. Must be > 0; larger is better (see NOTES.md).
     */
    function createVault(address token, uint32 rewardsCycleLength, uint256 seedAssets)
        external
        returns (address vault)
    {
        if (token.code.length == 0) revert TokenNotAContract();
        if (seedAssets == 0) revert SeedRequired();

        address existing = vaultFor[token];
        if (existing != address(0)) revert VaultAlreadyExists(existing);

        string memory symbol = _symbolOf(token);

        vault = address(
            new SaveVault{salt: keccak256(abi.encode(token))}(
                IERC20(token), rewardsCycleLength, string.concat("Saved ", symbol), string.concat("sv", symbol)
            )
        );

        // Record before the external token calls below.
        vaultFor[token] = vault;
        allVaults.push(vault);

        // Seed: pull from the lister, deposit, lock the shares. The vault itself verifies the
        // balance delta, so a fee-on-transfer token fails here rather than after listing.
        IERC20(token).safeTransferFrom(msg.sender, address(this), seedAssets);
        IERC20(token).forceApprove(vault, seedAssets);
        SaveVault(vault).deposit(seedAssets, BURN_ADDRESS);
        // Clear any residue in case the token ignored part of the allowance.
        IERC20(token).forceApprove(vault, 0);

        emit VaultCreated(token, vault, msg.sender, seedAssets);
    }

    /// @notice Number of vaults listed so far.
    function vaultCount() external view returns (uint256) {
        return allVaults.length;
    }

    /// @notice Address the vault for `token` would occupy, whether or not it has been created.
    function predictVaultAddress(address token, uint32 rewardsCycleLength) external view returns (address) {
        string memory symbol = _symbolOf(token);
        bytes32 initCodeHash = keccak256(
            abi.encodePacked(
                type(SaveVault).creationCode,
                abi.encode(
                    IERC20(token), rewardsCycleLength, string.concat("Saved ", symbol), string.concat("sv", symbol)
                )
            )
        );
        return Create2.computeAddress(keccak256(abi.encode(token)), initCodeHash, address(this));
    }

    /**
     * @dev Reads `symbol()` without trusting the token to implement it as ERC-20 specifies.
     *      Uses a low-level staticcall so a missing, reverting, or `bytes32`-returning `symbol()`
     *      (MKR and friends) cannot brick listing or make the deployment revert on a decode failure.
     */
    function _symbolOf(address token) private view returns (string memory) {
        (bool ok, bytes memory data) = token.staticcall(abi.encodeWithSignature("symbol()"));
        if (!ok || data.length == 0) return "TOKEN";

        if (data.length == 32) {
            // bytes32-style symbol: trim trailing zero bytes.
            bytes32 raw = abi.decode(data, (bytes32));
            uint256 len;
            while (len < 32 && raw[len] != 0) {
                len++;
            }
            if (len == 0) return "TOKEN";
            bytes memory out = new bytes(len);
            for (uint256 i; i < len; i++) {
                out[i] = raw[i];
            }
            return string(out);
        }

        // Standard ABI-encoded string. Guard against malformed offsets/lengths.
        if (data.length < 64) return "TOKEN";
        uint256 strLen;
        assembly {
            strLen := mload(add(data, 0x40))
        }
        if (strLen == 0 || strLen > 32 || data.length < 64 + strLen) return "TOKEN";

        bytes memory sym = new bytes(strLen);
        for (uint256 i; i < strLen; i++) {
            sym[i] = data[64 + i];
        }
        return string(sym);
    }
}

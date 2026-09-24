// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SaveVault} from "./SaveVault.sol";
import {TokenMetadata} from "./libraries/TokenMetadata.sol";

/**
 * @title SaveVaultFactory
 * @notice Permissionless registry: anyone can list any ERC-20 and get a {SaveVault} for it.
 *
 * @dev The factory has no owner and no allowlist — that is the product. What it does
 *      guarantee is that the *registry* is trustworthy even though its contents are not:
 *
 *      - exactly one canonical vault per token, so liquidity cannot be split across
 *        rival vaults for the same asset and a UI resolving `vaultFor(token)` always
 *        lands on the same address;
 *      - vaults are deployed with CREATE2 at an address derived from the token, so the
 *        vault address can be verified off-chain before anyone deposits;
 *      - the underlying must have code, so a vault can never be created over an EOA or
 *        an empty address where token transfers would silently no-op.
 *
 *      Listing a token is *not* an endorsement of it. See NOTES.md for what a token
 *      has to be for its vault to behave, and what to check before depositing.
 */
contract SaveVaultFactory {
    /// @notice The proposed underlying has no code at this address.
    error NotAContract(address token);
    /// @notice This token already has a canonical vault.
    error VaultAlreadyExists(address token, address vault);

    /// @notice Canonical vault for each listed underlying. Zero if not yet listed.
    mapping(address token => SaveVault vault) public vaultFor;

    /// @notice Every vault ever created, in listing order.
    SaveVault[] public allVaults;

    event VaultCreated(address indexed token, address indexed vault, address indexed creator, uint256 index);

    /**
     * @notice List `token` and deploy its canonical vault.
     * @dev Reverts if `token` is already listed; read {vaultFor} first.
     */
    function createVault(IERC20 token) external returns (SaveVault vault) {
        address tokenAddr = address(token);
        if (tokenAddr.code.length == 0) revert NotAContract(tokenAddr);

        SaveVault existing = vaultFor[tokenAddr];
        if (address(existing) != address(0)) revert VaultAlreadyExists(tokenAddr, address(existing));

        // Cosmetic only, and deliberately failure-proof: a hostile `symbol()` must not
        // be able to make listing revert or burn unbounded gas.
        string memory symbol = TokenMetadata.safeSymbol(tokenAddr);
        string memory name = TokenMetadata.safeName(tokenAddr);

        vault = new SaveVault{salt: _salt(tokenAddr)}(
            token, string.concat("Saved ", name), string.concat("sv", symbol)
        );

        vaultFor[tokenAddr] = vault;
        allVaults.push(vault);

        emit VaultCreated(tokenAddr, address(vault), msg.sender, allVaults.length - 1);
    }

    /// @notice Number of vaults listed so far.
    function allVaultsLength() external view returns (uint256) {
        return allVaults.length;
    }

    /**
     * @notice Address a vault for `token` would be deployed at.
     * @dev Depends on the metadata the token reports at listing time, since name and
     *      symbol are constructor arguments. A token that changes its `symbol()` between
     *      the quote and the listing changes the resulting address; always confirm
     *      against {vaultFor} after listing rather than trusting a stale prediction.
     */
    function predictVaultAddress(IERC20 token) external view returns (address) {
        address tokenAddr = address(token);
        bytes memory creationCode = abi.encodePacked(
            type(SaveVault).creationCode,
            abi.encode(
                token,
                string.concat("Saved ", TokenMetadata.safeName(tokenAddr)),
                string.concat("sv", TokenMetadata.safeSymbol(tokenAddr))
            )
        );
        return address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(bytes1(0xff), address(this), _salt(tokenAddr), keccak256(creationCode))
                    )
                )
            )
        );
    }

    function _salt(address token) private pure returns (bytes32) {
        return bytes32(uint256(uint160(token)));
    }
}

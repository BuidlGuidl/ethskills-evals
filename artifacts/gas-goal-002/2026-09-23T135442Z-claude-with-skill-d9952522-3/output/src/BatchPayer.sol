// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal ERC-20 surface. Returns are handled manually because some
/// tokens (USDT-style) return no data on success.
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title BatchPayer
/// @notice Pays many ERC-20 recipients in a single transaction, pulling funds
///         from the relayer's own wallet via `transferFrom`.
///
/// Gas model: an EOA-per-payment scheme pays the 21,000 intrinsic gas plus a
/// fresh sender-nonce/balance warm-up on every single payment. Batching pays
/// that once per batch instead of once per payment. The per-recipient body
/// (two SSTOREs on the token) is unavoidable and is unchanged here.
///
/// The relayer approves this contract once for the token; funds are never held
/// by the contract, so an idle approval is the only standing exposure.
contract BatchPayer {
    error NotOwner();
    error LengthMismatch();
    error TransferFailed(uint256 index);

    address public immutable owner;

    constructor(address _owner) {
        owner = _owner;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @notice Send `amounts[i]` of `token` to `recipients[i]`, funded from `owner`.
    /// @dev Reverts the whole batch if any leg fails, so a batch is all-or-nothing
    ///      and the caller never has to reconcile a partial run.
    function pay(IERC20 token, address[] calldata recipients, uint256[] calldata amounts)
        external
        onlyOwner
    {
        if (recipients.length != amounts.length) revert LengthMismatch();

        address from = owner;
        for (uint256 i; i < recipients.length;) {
            _transferFrom(token, from, recipients[i], amounts[i], i);
            unchecked { ++i; }
        }
    }

    /// @notice Variant for the common case where every recipient gets the same amount.
    /// @dev Halves calldata versus `pay` and drops one array bounds check per leg.
    function payUniform(IERC20 token, address[] calldata recipients, uint256 amount)
        external
        onlyOwner
    {
        address from = owner;
        for (uint256 i; i < recipients.length;) {
            _transferFrom(token, from, recipients[i], amount, i);
            unchecked { ++i; }
        }
    }

    /// @dev Raw call so that no-return-data tokens are treated as success, matching
    ///      the behaviour of a standard SafeERC20 without pulling in the dependency.
    function _transferFrom(IERC20 token, address from, address to, uint256 amount, uint256 index)
        private
    {
        (bool ok, bytes memory data) = address(token).call(
            abi.encodeCall(IERC20.transferFrom, (from, to, amount))
        );
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TransferFailed(index);
        }
    }
}

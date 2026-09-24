// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @notice Batches ERC-20 payouts from a relayer wallet into one transaction.
/// @dev The 21,000 gas intrinsic cost and the per-transaction L1 data overhead are
///      paid once per batch instead of once per payout. Only `owner` may disperse;
///      the contract is not meant to custody funds between batches.
contract BatchTransfer {
    address public immutable owner;

    error NotOwner();
    error LengthMismatch();
    error TransferFailed();
    error EmptyBatch();

    constructor(address owner_) {
        owner = owner_;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @notice Pull-and-push: one `transferFrom` for the batch total, then one
    ///         `transfer` per recipient. Requires the relayer to approve this
    ///         contract once. Cheapest of the three entry points per recipient.
    /// @param packed One word per payout: `address` in the high 160 bits,
    ///        amount in the low 96 bits. 96 bits holds 79e12 USDC (6 decimals),
    ///        far above any single payout.
    function dispersePacked(IERC20 token, bytes32[] calldata packed) external onlyOwner {
        uint256 n = packed.length;
        if (n == 0) revert EmptyBatch();

        uint256 total;
        for (uint256 i; i < n; ++i) {
            total += uint256(packed[i]) & type(uint96).max;
        }
        _call(token, abi.encodeCall(IERC20.transferFrom, (msg.sender, address(this), total)));

        for (uint256 i; i < n; ++i) {
            uint256 w = uint256(packed[i]);
            _call(token, abi.encodeCall(IERC20.transfer, (address(uint160(w >> 96)), w & type(uint96).max)));
        }
    }

    /// @notice Same as `dispersePacked` but with conventional array arguments,
    ///         for payouts that exceed the 96-bit amount field.
    function disperse(IERC20 token, address[] calldata to, uint256[] calldata amounts) external onlyOwner {
        uint256 n = to.length;
        if (n == 0) revert EmptyBatch();
        if (n != amounts.length) revert LengthMismatch();

        uint256 total;
        for (uint256 i; i < n; ++i) {
            total += amounts[i];
        }
        _call(token, abi.encodeCall(IERC20.transferFrom, (msg.sender, address(this), total)));

        for (uint256 i; i < n; ++i) {
            _call(token, abi.encodeCall(IERC20.transfer, (to[i], amounts[i])));
        }
    }

    /// @notice Pure pull: one `transferFrom` per recipient, funds never touch this
    ///         contract. Costs more gas than `disperse` because the token writes the
    ///         relayer's allowance on every payout, but it holds no balance.
    function disperseFrom(IERC20 token, address[] calldata to, uint256[] calldata amounts) external onlyOwner {
        uint256 n = to.length;
        if (n == 0) revert EmptyBatch();
        if (n != amounts.length) revert LengthMismatch();

        for (uint256 i; i < n; ++i) {
            _call(token, abi.encodeCall(IERC20.transferFrom, (msg.sender, to[i], amounts[i])));
        }
    }

    /// @dev Accepts tokens that return nothing as well as tokens that return a bool.
    function _call(IERC20 token, bytes memory data) private {
        (bool ok, bytes memory ret) = address(token).call(data);
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed();
    }
}

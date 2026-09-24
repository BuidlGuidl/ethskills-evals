// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Like {
    function balanceOf(address account) external view returns (uint256);
}

/// @notice Owner-controlled ERC-20 payout batcher.
/// @dev Fund this contract with the token before calling batchTransfer.
contract PaymentBatcher {
    struct Payment {
        address to;
        uint256 amount;
    }

    address public owner;

    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event BatchTransfer(address indexed token, uint256 count, uint256 totalAmount);
    event TokenRescued(address indexed token, address indexed to, uint256 amount);

    error NotOwner();
    error ZeroAddress();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function batchTransfer(address token, Payment[] calldata payments)
        external
        onlyOwner
        returns (uint256 totalAmount)
    {
        if (token == address(0)) revert ZeroAddress();

        uint256 length = payments.length;
        for (uint256 i; i < length;) {
            Payment calldata payment = payments[i];
            if (payment.to == address(0)) revert ZeroAddress();

            totalAmount += payment.amount;
            _safeTransfer(token, payment.to, payment.amount);

            unchecked {
                ++i;
            }
        }

        emit BatchTransfer(token, length, totalAmount);
    }

    function rescueToken(address token, address to, uint256 amount) external onlyOwner {
        if (token == address(0) || to == address(0)) revert ZeroAddress();
        _safeTransfer(token, to, amount);
        emit TokenRescued(token, to, amount);
    }

    function tokenBalance(address token) external view returns (uint256) {
        return IERC20Like(token).balanceOf(address(this));
    }

    function _safeTransfer(address token, address to, uint256 amount) private {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}

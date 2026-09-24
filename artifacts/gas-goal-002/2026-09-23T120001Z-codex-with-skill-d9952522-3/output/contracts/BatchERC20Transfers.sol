// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IERC20Transfer {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract BatchERC20Transfers {
    struct Payment {
        address to;
        uint256 amount;
    }

    address public immutable owner;

    error EmptyBatch();
    error TransferFailed(uint256 index);
    error Unauthorized();
    error ZeroAddress();

    constructor(address owner_) {
        if (owner_ == address(0)) revert ZeroAddress();
        owner = owner_;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    function batchTransfer(IERC20Transfer token, Payment[] calldata payments)
        external
        onlyOwner
        returns (uint256 total)
    {
        uint256 length = payments.length;
        if (length == 0) revert EmptyBatch();

        for (uint256 i; i < length;) {
            Payment calldata payment = payments[i];
            _callToken(
                address(token),
                abi.encodeCall(IERC20Transfer.transfer, (payment.to, payment.amount)),
                i
            );
            total += payment.amount;

            unchecked {
                ++i;
            }
        }
    }

    function batchTransferFrom(IERC20Transfer token, address from, Payment[] calldata payments)
        external
        onlyOwner
        returns (uint256 total)
    {
        if (from == address(0)) revert ZeroAddress();

        uint256 length = payments.length;
        if (length == 0) revert EmptyBatch();

        for (uint256 i; i < length;) {
            Payment calldata payment = payments[i];
            _callToken(
                address(token),
                abi.encodeCall(IERC20Transfer.transferFrom, (from, payment.to, payment.amount)),
                i
            );
            total += payment.amount;

            unchecked {
                ++i;
            }
        }
    }

    function _callToken(address token, bytes memory data, uint256 index) private {
        (bool ok, bytes memory returnData) = token.call(data);
        if (!ok || (returnData.length != 0 && !abi.decode(returnData, (bool)))) {
            revert TransferFailed(index);
        }
    }
}

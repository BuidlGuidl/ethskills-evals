// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
}

contract BatchExecutor {
    error NotSelf();
    error LengthMismatch();
    error BadEntryLength();
    error TransferFailed();

    event BatchSettled(address indexed token, uint256 count, uint256 total);

    receive() external payable {}

    modifier onlySelf() {
        if (msg.sender != address(this)) revert NotSelf();
        _;
    }

    function distribute(address token, address[] calldata recipients, uint256[] calldata amounts) external onlySelf {
        uint256 n = recipients.length;
        if (n != amounts.length) revert LengthMismatch();
        uint256 total;
        for (uint256 i; i < n; ++i) {
            if (!IERC20(token).transfer(recipients[i], amounts[i])) revert TransferFailed();
            total += amounts[i];
        }
        emit BatchSettled(token, n, total);
    }

    function distributePacked(address token, bytes calldata blob) external onlySelf {
        uint256 blobLen = blob.length;
        if (blobLen % 28 != 0) revert BadEntryLength();
        uint256 n = blobLen / 28;
        uint256 total;
        for (uint256 i; i < n; ++i) {
            uint256 entry;
            assembly {
                entry := calldataload(add(blob.offset, mul(i, 28)))
            }
            address to = address(uint160(entry >> 96));
            uint256 amount = uint256(entry >> 32 & 0xffffffffffffffff);
            if (!IERC20(token).transfer(to, amount)) revert TransferFailed();
            total += amount;
        }
        emit BatchSettled(token, n, total);
    }
}

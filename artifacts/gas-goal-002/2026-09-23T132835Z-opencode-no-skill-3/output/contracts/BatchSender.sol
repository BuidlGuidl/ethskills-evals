// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IERC20Transfer {
    function transfer(address to, uint256 amount) external returns (bool);
}

contract BatchSender {
    uint256 public constant MAX_BATCH = 256;

    address public immutable owner;

    error NotOwner();
    error EmptyBatch();
    error TooManyItems(uint256 count);
    error ZeroToken();
    error ZeroRecipient(uint256 index);
    error ZeroAmount(uint256 index);
    error TransferFailed(uint256 index);

    event Failures(uint256 bitmap);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function send(address token, bytes32[] calldata items) external onlyOwner {
        uint256 count = items.length;
        if (count == 0) revert EmptyBatch();
        if (count > MAX_BATCH) revert TooManyItems(count);
        if (token == address(0)) revert ZeroToken();
        for (uint256 i = 0; i < count; ++i) {
            (address recipient, uint256 amount) = _decode(items[i]);
            if (recipient == address(0)) revert ZeroRecipient(i);
            if (amount == 0) revert ZeroAmount(i);
            (bool ok, bytes memory result) = _callTransfer(token, recipient, amount);
            if (!_isSuccess(ok, result)) revert TransferFailed(i);
        }
    }

    function sendSafe(address token, bytes32[] calldata items) external onlyOwner returns (uint256 failures) {
        uint256 count = items.length;
        if (count == 0) revert EmptyBatch();
        if (count > MAX_BATCH) revert TooManyItems(count);
        if (token == address(0)) revert ZeroToken();
        for (uint256 i = 0; i < count; ++i) {
            (address recipient, uint256 amount) = _decode(items[i]);
            if (recipient == address(0) || amount == 0) {
                failures |= 1 << i;
                continue;
            }
            (bool ok, bytes memory result) = _callTransfer(token, recipient, amount);
            if (!_isSuccess(ok, result)) failures |= 1 << i;
        }
        if (failures != 0) {
            emit Failures(failures);
        }
    }

    function _decode(bytes32 item) internal pure returns (address recipient, uint256 amount) {
        recipient = address(uint160(uint256(item) >> 96));
        amount = uint256(uint96(uint256(item)));
    }

    function _callTransfer(address token, address recipient, uint256 amount)
        internal
        returns (bool ok, bytes memory result)
    {
        (ok, result) = token.call(abi.encodeWithSelector(IERC20Transfer.transfer.selector, recipient, amount));
    }

    function _isSuccess(bool ok, bytes memory result) internal pure returns (bool) {
        if (!ok) return false;
        if (result.length == 0) return true;
        return abi.decode(result, (bool));
    }
}

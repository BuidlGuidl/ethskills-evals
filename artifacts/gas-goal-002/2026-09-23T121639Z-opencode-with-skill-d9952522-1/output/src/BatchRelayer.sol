// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract BatchRelayer {
    address public immutable owner;

    bytes4 private constant TRANSFER = 0xA9059CBB;
    bytes4 private constant TRANSFER_FROM = 0x23B872DD;
    bytes4 private constant BALANCE_OF = 0x70A08231;

    error Unauthorized();
    error LengthMismatch();
    error TransferFailed(uint256 index);
    error RescueFailed();

    event BatchTransferFrom(address indexed token, address indexed from, uint256 count);
    event BatchTransfer(address indexed token, uint256 count);
    event Rescued(address indexed token, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    function batchTransferFrom(
        address token,
        address from,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwner {
        uint256 count = recipients.length;
        if (count == 0 || count != amounts.length) revert LengthMismatch();

        for (uint256 i = 0; i < count; ++i) {
            (bool ok, bytes memory ret) = token.call(
                abi.encodeWithSelector(TRANSFER_FROM, from, recipients[i], amounts[i])
            );
            if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed(i);
        }

        emit BatchTransferFrom(token, from, count);
    }

    function batchTransfer(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwner {
        uint256 count = recipients.length;
        if (count == 0 || count != amounts.length) revert LengthMismatch();

        for (uint256 i = 0; i < count; ++i) {
            (bool ok, bytes memory ret) = token.call(
                abi.encodeWithSelector(TRANSFER, recipients[i], amounts[i])
            );
            if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed(i);
        }

        emit BatchTransfer(token, count);
    }

    function rescue(address token) external onlyOwner {
        if (token == address(0)) {
            (bool ok,) = owner.call{value: address(this).balance}("");
            if (!ok) revert RescueFailed();
            emit Rescued(address(0), address(this).balance);
            return;
        }
        (bool ok, bytes memory ret) = token.staticcall(abi.encodeWithSelector(BALANCE_OF, address(this)));
        if (!ok || ret.length != 32) revert RescueFailed();
        uint256 amount = abi.decode(ret, (uint256));
        (ok, ret) = token.call(abi.encodeWithSelector(TRANSFER, owner, amount));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert RescueFailed();
        emit Rescued(token, amount);
    }

    receive() external payable {}
}

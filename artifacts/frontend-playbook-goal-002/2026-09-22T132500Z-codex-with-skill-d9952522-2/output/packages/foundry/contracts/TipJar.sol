// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract TipJar {
    error EmptyName();
    error EmptyMessage();
    error InvalidAmount();
    error InvalidRecipient();
    error NotOwner();
    error TokenTransferFailed();

    struct Tip {
        address from;
        string name;
        string message;
        uint256 amount;
        uint256 timestamp;
    }

    IERC20 public immutable usdc;
    address public immutable owner;
    uint256 public totalTips;
    uint256 public tipCount;

    mapping(uint256 => Tip) public tips;

    event TipSent(
        uint256 indexed tipId, address indexed from, string name, string message, uint256 amount, uint256 timestamp
    );
    event Withdrawn(address indexed recipient, uint256 amount);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _owner, address _usdc) {
        if (_owner == address(0) || _usdc == address(0)) revert InvalidRecipient();

        owner = _owner;
        usdc = IERC20(_usdc);
    }

    function tip(string calldata name, string calldata message, uint256 amount) external {
        if (bytes(name).length == 0) revert EmptyName();
        if (bytes(message).length == 0) revert EmptyMessage();
        if (amount == 0) revert InvalidAmount();

        uint256 tipId = tipCount;
        uint256 timestamp = block.timestamp;

        _safeTransferFrom(address(usdc), msg.sender, address(this), amount);

        tips[tipId] = Tip({ from: msg.sender, name: name, message: message, amount: amount, timestamp: timestamp });
        tipCount = tipId + 1;
        totalTips += amount;

        emit TipSent(tipId, msg.sender, name, message, amount, timestamp);
    }

    function withdraw(address recipient, uint256 amount) external onlyOwner {
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount == 0) revert InvalidAmount();

        _safeTransfer(address(usdc), recipient, amount);

        emit Withdrawn(recipient, amount);
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
        (bool success, bytes memory data) =
            token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
    }

    function _safeTransfer(address token, address to, uint256 amount) private {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "./interfaces/IERC20.sol";
import {ILendingMarket} from "./interfaces/ILendingMarket.sol";

/// @notice Custody and per-user accounting for collateral. Only the market can seize.
contract CollateralVault {
    address public immutable market;

    mapping(address => bool) public supported;
    mapping(address => mapping(address => uint256)) public balanceOf;

    error NotMarket();
    error TokenNotSupported(address token);
    error InsufficientBalance();

    event Deposited(address indexed user, address indexed token, uint256 amount);
    event Withdrawn(address indexed user, address indexed token, uint256 amount);
    event Seized(address indexed user, address indexed token, address indexed to, uint256 amount);

    modifier onlyMarket() {
        if (msg.sender != market) revert NotMarket();
        _;
    }

    constructor(address market_) {
        market = market_;
    }

    function setSupported(address token, bool isSupported) external onlyMarket {
        supported[token] = isSupported;
    }

    function deposit(address token, uint256 amount) external {
        if (!supported[token]) revert TokenNotSupported(token);

        IERC20(token).transferFrom(msg.sender, address(this), amount);
        balanceOf[msg.sender][token] += amount;

        emit Deposited(msg.sender, token, amount);
    }

    function withdraw(address token, uint256 amount) external {
        uint256 balance = balanceOf[msg.sender][token];
        if (balance < amount) revert InsufficientBalance();

        IERC20(token).transfer(msg.sender, amount);
        balanceOf[msg.sender][token] = balance - amount;
        ILendingMarket(market).requireHealthy(msg.sender);

        emit Withdrawn(msg.sender, token, amount);
    }

    function seize(address user, address token, address to, uint256 amount) external onlyMarket {
        balanceOf[user][token] -= amount;
        IERC20(token).transfer(to, amount);

        emit Seized(user, token, to, amount);
    }
}

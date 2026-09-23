// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @dev Vanilla-shaped ERC-20 whose transfer performs the same storage reads
///      as Circle's FiatToken (paused flag + blacklist lookups on both
///      parties), so forge gas measurements approximate real USDC costs.
contract TestToken {
    string public constant name = "Test USDC";
    string public constant symbol = "TUSDC";
    uint8 public constant decimals = 6;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public isBlacklisted;
    bool public paused;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Blacklisted(address indexed account);
    event Unblacklisted(address indexed account);
    event Pause();
    event Unpause();

    error TokenPaused();
    error AccountBlacklisted(address account);
    error InsufficientBalance();
    error InsufficientAllowance();

    constructor() {
        balanceOf[msg.sender] = 1e30;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function blacklist(address account) external {
        isBlacklisted[account] = true;
        emit Blacklisted(account);
    }

    function unblacklist(address account) external {
        isBlacklisted[account] = false;
        emit Unblacklisted(account);
    }

    function setPaused(bool status) external {
        paused = status;
        if (status) {
            emit Pause();
        } else {
            emit Unpause();
        }
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed < amount) revert InsufficientAllowance();
        allowance[from][msg.sender] = allowed - amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (paused) revert TokenPaused();
        if (isBlacklisted[from]) revert AccountBlacklisted(from);
        if (isBlacklisted[to]) revert AccountBlacklisted(to);
        uint256 fromBalance = balanceOf[from];
        if (fromBalance < amount) revert InsufficientBalance();
        balanceOf[from] = fromBalance - amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}

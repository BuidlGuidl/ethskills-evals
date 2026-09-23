// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockUSDC {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public blacklisted;
    mapping(address => bool) public frozen;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);
    error Blacklisted(address account);
    error Frozen(address account);
    error InsufficientBalance();
    error InsufficientAllowance();

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function blacklist(address account) external {
        blacklisted[account] = true;
    }

    function freeze(address account) external {
        frozen[account] = true;
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        if (blacklisted[msg.sender]) revert Blacklisted(msg.sender);
        if (blacklisted[to]) revert Blacklisted(to);
        if (frozen[to]) revert Frozen(to);
        uint256 fromBal = balanceOf[msg.sender];
        if (fromBal < amount) revert InsufficientBalance();
        balanceOf[msg.sender] = fromBal - amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        if (blacklisted[from]) revert Blacklisted(from);
        if (blacklisted[to]) revert Blacklisted(to);
        if (frozen[to]) revert Frozen(to);
        uint256 fromBal = balanceOf[from];
        if (fromBal < amount) revert InsufficientBalance();
        uint256 allowed = allowance[from][msg.sender];
        if (allowed < amount) revert InsufficientAllowance();
        allowance[from][msg.sender] = allowed - amount;
        balanceOf[from] = fromBal - amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

contract ReturningFalseToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }
}

contract RevertingToken {
    error No();
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address, address, uint256) external pure returns (bool) {
        revert No();
    }
}

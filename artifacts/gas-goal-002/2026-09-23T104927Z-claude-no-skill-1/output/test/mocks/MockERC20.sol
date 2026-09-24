// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @dev Test token with a USDC-style blacklist and an optional silent-return mode.
contract MockERC20 {
    string public name = "Mock";
    uint8 public decimals = 6;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public blacklisted;
    bool public returnsNothing;

    function setBlacklisted(address a, bool v) external { blacklisted[a] = v; }
    function setReturnsNothing(bool v) external { returnsNothing = v; }
    function mint(address to, uint256 a) external { balanceOf[to] += a; }
    function approve(address s, uint256 a) external returns (bool) { allowance[msg.sender][s] = a; return true; }

    function transfer(address to, uint256 a) external returns (bool) {
        _move(msg.sender, to, a);
        if (returnsNothing) assembly { return(0, 0) }
        return true;
    }

    function transferFrom(address f, address to, uint256 a) external returns (bool) {
        uint256 al = allowance[f][msg.sender];
        require(al >= a, "allowance");
        if (al != type(uint256).max) allowance[f][msg.sender] = al - a;
        _move(f, to, a);
        if (returnsNothing) assembly { return(0, 0) }
        return true;
    }

    function _move(address f, address t, uint256 a) private {
        require(!blacklisted[f] && !blacklisted[t], "blacklisted");
        require(balanceOf[f] >= a, "balance");
        unchecked { balanceOf[f] -= a; }
        balanceOf[t] += a;
    }
}

/// @dev Returns `false` rather than reverting, like some non-compliant tokens.
contract FalseReturningERC20 {
    function transfer(address, uint256) external pure returns (bool) { return false; }
    function balanceOf(address) external pure returns (uint256) { return 0; }
}

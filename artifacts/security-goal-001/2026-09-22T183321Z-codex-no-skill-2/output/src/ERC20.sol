// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20Metadata} from "./IERC20.sol";

contract ERC20 is IERC20Metadata {
    string public name;
    string public symbol;
    uint8 private immutable DECIMALS;

    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
        name = name_;
        symbol = symbol_;
        DECIMALS = decimals_;
    }

    function decimals() public view returns (uint8) {
        return DECIMALS;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= value, "ERC20: insufficient allowance");
            unchecked {
                allowance[from][msg.sender] = allowed - value;
            }
            emit Approval(from, msg.sender, allowance[from][msg.sender]);
        }

        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal virtual {
        require(to != address(0), "ERC20: transfer to zero");

        uint256 fromBalance = balanceOf[from];
        require(fromBalance >= value, "ERC20: insufficient balance");
        unchecked {
            balanceOf[from] = fromBalance - value;
            balanceOf[to] += value;
        }

        emit Transfer(from, to, value);
    }

    function _mint(address to, uint256 value) internal virtual {
        require(to != address(0), "ERC20: mint to zero");

        totalSupply += value;
        unchecked {
            balanceOf[to] += value;
        }

        emit Transfer(address(0), to, value);
    }

    function _burn(address from, uint256 value) internal virtual {
        uint256 fromBalance = balanceOf[from];
        require(fromBalance >= value, "ERC20: burn exceeds balance");

        unchecked {
            balanceOf[from] = fromBalance - value;
            totalSupply -= value;
        }

        emit Transfer(from, address(0), value);
    }
}

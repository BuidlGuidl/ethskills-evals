// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract MockERC20 {
    mapping(address => uint256) public balanceOf;

    constructor(address initialHolder, uint256 supply) {
        balanceOf[initialHolder] = supply;
    }

    function transfer(address recipient, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[recipient] += amount;
        return true;
    }
}

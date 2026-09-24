// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {TokenVault} from "../src/TokenVault.sol";
import {TokenVaultFactory} from "../src/TokenVaultFactory.sol";

contract TokenVaultTest {
    function testDepositAndYieldLiftClaim() external {
        MockERC20 token = new MockERC20("Mock", "MOCK", 18);
        TokenVaultFactory factory = new TokenVaultFactory();
        TokenVault vault = TokenVault(factory.createVault(address(token), "Save MOCK", "svMOCK"));

        token.mint(address(this), 150 ether);
        token.approve(address(vault), 100 ether);

        uint256 shares = vault.deposit(100 ether, address(this));
        require(shares == 100 ether * vault.VIRTUAL_SHARES(), "unexpected shares");
        require(vault.convertToAssets(shares) == 100 ether, "initial claim");

        require(token.transfer(address(vault), 50 ether), "yield transfer");
        require(vault.convertToAssets(shares) > 149.999999999999 ether, "yield not reflected");
    }

    function testFeeOnTransferDepositMintsOnReceivedAssets() external {
        MockERC20 token = new MockERC20("Fee", "FEE", 18);
        token.setTransferFeeBps(100);

        TokenVault vault = new TokenVault(address(token), "Save FEE", "svFEE", address(this));

        token.mint(address(this), 100 ether);
        token.approve(address(vault), 100 ether);

        uint256 shares = vault.deposit(100 ether, address(this));
        require(token.balanceOf(address(vault)) == 99 ether, "vault received amount");
        require(shares == 99 ether * vault.VIRTUAL_SHARES(), "shares use received amount");
    }
}

contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public totalSupply;
    uint256 public transferFeeBps;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
        name = name_;
        symbol = symbol_;
        decimals = decimals_;
    }

    function setTransferFeeBps(uint256 transferFeeBps_) external {
        transferFeeBps = transferFeeBps_;
    }

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 currentAllowance = allowance[from][msg.sender];
        require(currentAllowance >= amount, "allowance");
        allowance[from][msg.sender] = currentAllowance - amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "balance");

        uint256 fee = amount * transferFeeBps / 10_000;
        uint256 received = amount - fee;

        balanceOf[from] -= amount;
        balanceOf[to] += received;
        totalSupply -= fee;
    }
}

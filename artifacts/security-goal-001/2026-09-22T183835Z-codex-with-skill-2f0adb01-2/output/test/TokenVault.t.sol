// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {TokenVault} from "../src/TokenVault.sol";
import {TokenVaultFactory} from "../src/TokenVaultFactory.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";

contract MockERC20 {
    string public name = "Mock Token";
    string public symbol = "MOCK";
    uint8 public decimals = 18;

    uint256 public totalSupply;
    mapping(address account => uint256) public balanceOf;
    mapping(address owner => mapping(address spender => uint256)) public allowance;

    uint256 public feeBps;

    function setFeeBps(uint256 feeBps_) external {
        feeBps = feeBps_;
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

        if (currentAllowance != type(uint256).max) {
            allowance[from][msg.sender] = currentAllowance - amount;
        }

        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) private {
        require(balanceOf[from] >= amount, "balance");

        uint256 fee = (amount * feeBps) / 10_000;
        uint256 received = amount - fee;

        balanceOf[from] -= amount;
        balanceOf[to] += received;
        totalSupply -= fee;
    }
}

contract TokenVaultTest {
    function testYieldIncreasesClaimWithoutMintingShares() external {
        MockERC20 token = new MockERC20();
        TokenVault vault = new TokenVault(IERC20(address(token)), "Save MOCK", "svMOCK", token.decimals());

        token.mint(address(this), 110 ether);
        token.approve(address(vault), 100 ether);

        uint256 shares = vault.deposit(100 ether, address(this));
        uint256 supplyBeforeYield = vault.totalSupply();

        require(token.transfer(address(vault), 10 ether), "yield transfer failed");

        uint256 claimAfterYield = vault.previewRedeem(shares);
        require(vault.totalSupply() == supplyBeforeYield, "yield minted shares");
        require(claimAfterYield > 100 ether, "claim did not increase");
        require(claimAfterYield <= 110 ether, "claim too large");
    }

    function testDepositMintsAgainstActualReceivedAssets() external {
        MockERC20 token = new MockERC20();
        token.setFeeBps(100);

        TokenVault vault = new TokenVault(IERC20(address(token)), "Save FEE", "svFEE", token.decimals());

        token.mint(address(this), 1_000 ether);
        token.approve(address(vault), 1_000 ether);

        uint256 shares = vault.deposit(1_000 ether, address(this));

        require(token.balanceOf(address(vault)) == 990 ether, "wrong assets received");
        require(shares == 990 ether, "wrong shares minted");
        require(vault.balanceOf(address(this)) == 990 ether, "wrong share balance");
    }

    function testFactoryCreatesOnlyOneVaultPerAsset() external {
        MockERC20 token = new MockERC20();
        TokenVaultFactory factory = new TokenVaultFactory();

        address vault = factory.createVault(address(token), "Save MOCK", "svMOCK");

        require(vault != address(0), "no vault");
        require(factory.vaultForAsset(address(token)) == vault, "mapping not set");
        require(factory.allVaultsLength() == 1, "wrong length");

        try factory.createVault(address(token), "Save MOCK 2", "svMOCK2") returns (address) {
            revert("second vault created");
        } catch {}
    }
}

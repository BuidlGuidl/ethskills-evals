// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20, TokenSavingsVault, TokenSavingsVaultFactory} from "../src/TokenSavingsVault.sol";

contract Assert {
    function assertEq(uint256 actual, uint256 expected, string memory message) internal pure {
        if (actual != expected) {
            revert(message);
        }
    }

    function assertEq(address actual, address expected, string memory message) internal pure {
        if (actual != expected) {
            revert(message);
        }
    }

    function assertGt(uint256 actual, uint256 minimum, string memory message) internal pure {
        if (actual <= minimum) {
            revert(message);
        }
    }

    function assertApproxEqAbs(uint256 actual, uint256 expected, uint256 maxDelta, string memory message) internal pure {
        uint256 delta = actual > expected ? actual - expected : expected - actual;
        if (delta > maxDelta) {
            revert(message);
        }
    }
}

contract MockERC20 is IERC20 {
    string public name = "Mock Token";
    string public symbol = "MOCK";
    uint8 public decimals = 18;
    uint256 public override totalSupply;

    mapping(address account => uint256) public override balanceOf;
    mapping(address owner => mapping(address spender => uint256)) public override allowance;

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) public virtual override returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public virtual override returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "allowance");
            allowance[from][msg.sender] = allowed - amount;
            emit Approval(from, msg.sender, allowance[from][msg.sender]);
        }

        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "to");
        uint256 balance = balanceOf[from];
        require(balance >= amount, "balance");
        balanceOf[from] = balance - amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}

contract FeeOnTransferToken is MockERC20 {
    uint256 public feeBps = 100;

    function transfer(address to, uint256 amount) public override returns (bool) {
        _feeTransfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "allowance");
            allowance[from][msg.sender] = allowed - amount;
            emit Approval(from, msg.sender, allowance[from][msg.sender]);
        }

        _feeTransfer(from, to, amount);
        return true;
    }

    function _feeTransfer(address from, address to, uint256 amount) internal {
        uint256 fee = amount * feeBps / 10_000;
        _transfer(from, address(0xfee), fee);
        _transfer(from, to, amount - fee);
    }
}

contract Receiver {
    function redeem(TokenSavingsVault vault, uint256 shares, address receiver) external returns (uint256) {
        return vault.redeem(shares, receiver, address(this));
    }
}

contract TokenSavingsVaultTest is Assert {
    MockERC20 private token;
    TokenSavingsVaultFactory private factory;
    TokenSavingsVault private vault;

    function setUp() public {
        token = new MockERC20();
        factory = new TokenSavingsVaultFactory();
        vault = TokenSavingsVault(factory.createVault(address(token)));

        token.mint(address(this), 1_000 ether);
        token.approve(address(vault), type(uint256).max);
    }

    function testFactoryRegistersOneVaultPerAsset() public view {
        assertEq(factory.vaultFor(address(token)), address(vault), "registered vault");
        assertEq(factory.allVaultsLength(), 1, "vault count");
    }

    function testKeeperTransferIncreasesDepositorClaim() public {
        uint256 shares = vault.deposit(100 ether, address(this));
        assertEq(vault.convertToAssets(shares), 100 ether, "initial claim");

        token.mint(address(vault), 25 ether);

        assertGt(vault.convertToAssets(shares), 124 ether, "claim includes yield");

        uint256 assets = vault.redeem(shares, address(this), address(this));
        assertApproxEqAbs(assets, 125 ether, 1, "redeemed pro rata claim");
    }

    function testReceiptCanMoveAndNewHolderCanRedeem() public {
        uint256 shares = vault.deposit(40 ether, address(this));
        Receiver receiver = new Receiver();

        require(vault.transfer(address(receiver), shares / 2), "transfer shares");
        token.mint(address(vault), 40 ether);

        uint256 beforeBalance = token.balanceOf(address(0xBEEF));
        receiver.redeem(vault, shares / 2, address(0xBEEF));

        assertApproxEqAbs(token.balanceOf(address(0xBEEF)) - beforeBalance, 40 ether, 1, "receiver redeemed moved shares");
    }

    function testDepositUsesActualReceivedAmountForFeeTokens() public {
        FeeOnTransferToken feeToken = new FeeOnTransferToken();
        TokenSavingsVault feeVault = TokenSavingsVault(factory.createVault(address(feeToken)));

        feeToken.mint(address(this), 100 ether);
        feeToken.approve(address(feeVault), type(uint256).max);

        feeVault.deposit(100 ether, address(this));

        assertEq(feeVault.totalAssets(), 99 ether, "vault received net assets");
        assertEq(feeVault.convertToAssets(feeVault.balanceOf(address(this))), 99 ether, "shares track net assets");
    }
}

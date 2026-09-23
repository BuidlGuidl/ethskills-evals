// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PaymentBatcher, IERC20} from "../contracts/PaymentBatcher.sol";

contract MockERC20 is IERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract PaymentBatcherTest {
    PaymentBatcher private batcher;
    MockERC20 private token;
    address private owner = address(this);
    function setUp() public {
        batcher = new PaymentBatcher(owner);
        token = new MockERC20();
    }

    function testDistributePaysRecipients() public {
        address[] memory recipients = _recipients(3);
        uint256[] memory amounts = _amounts(3, 100);
        token.mint(address(batcher), 600);

        uint256 total = batcher.distribute(token, recipients, amounts);

        assert(total == 600);
        assert(token.balanceOf(recipients[0]) == 100);
        assert(token.balanceOf(recipients[1]) == 200);
        assert(token.balanceOf(recipients[2]) == 300);
    }

    function testPullAndDistributePaysRecipients() public {
        address[] memory recipients = _recipients(2);
        uint256[] memory amounts = _amounts(2, 100);
        token.mint(address(this), 300);
        token.approve(address(batcher), 300);

        uint256 total = batcher.pullAndDistribute(token, address(this), recipients, amounts);

        assert(total == 300);
        assert(token.balanceOf(recipients[0]) == 100);
        assert(token.balanceOf(recipients[1]) == 200);
    }

    function testGasDistribute250() public {
        address[] memory recipients = _recipients(250);
        uint256[] memory amounts = _amounts(250, 1);
        token.mint(address(batcher), 31_375);

        uint256 beforeGas = gasleft();
        uint256 total = batcher.distribute(token, recipients, amounts);
        uint256 used = beforeGas - gasleft();

        assert(total == 31_375);
        assert(used < 6_700_000);
    }

    function testGasPullAndDistribute250() public {
        address[] memory recipients = _recipients(250);
        uint256[] memory amounts = _amounts(250, 1);
        token.mint(address(this), 31_375);
        token.approve(address(batcher), 31_375);

        uint256 beforeGas = gasleft();
        uint256 total = batcher.pullAndDistribute(token, address(this), recipients, amounts);
        uint256 used = beforeGas - gasleft();

        assert(total == 31_375);
        assert(used < 7_000_000);
    }

    function _recipients(uint256 count) private pure returns (address[] memory recipients) {
        recipients = new address[](count);
        for (uint256 i; i < count; ++i) {
            recipients[i] = address(uint160(0x1000 + i));
        }
    }

    function _amounts(uint256 count, uint256 base) private pure returns (uint256[] memory amounts) {
        amounts = new uint256[](count);
        for (uint256 i; i < count; ++i) {
            amounts[i] = base * (i + 1);
        }
    }
}

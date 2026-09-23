// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {Batcher, IERC20} from "../src/Batcher.sol";

/// @dev Minimal ERC-20 with USDC-like 6 decimals. No external deps.
contract MockERC20 {
    string public name = "Mock USD Coin";
    string public symbol = "mUSDC";
    uint8 public constant decimals = 6;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "insufficient allowance");
            allowance[from][msg.sender] = allowed - amount;
        }
        _move(from, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}

contract BatcherTest is Test {
    Batcher batcher;
    MockERC20 token;
    address relayer = address(this);

    function setUp() public {
        batcher = new Batcher();
        token = new MockERC20();
        token.mint(relayer, 1_000_000e6);
        token.approve(address(batcher), type(uint256).max);
    }

    function _recipients(uint256 n, uint256 offset) internal pure returns (address[] memory to) {
        to = new address[](n);
        for (uint256 i; i < n; ++i) {
            // Fresh addresses => worst-case (cold recipient slot) gas.
            to[i] = address(uint160(0x10000 + offset + i));
        }
    }

    function _amounts(uint256 n) internal pure returns (uint256[] memory amounts) {
        amounts = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            amounts[i] = 1e6 + i; // distinct small amounts
        }
    }

    function testBatchPaysEveryone() public {
        uint256 n = 20;
        address[] memory to = _recipients(n, 0);
        uint256[] memory amounts = _amounts(n);

        bool[] memory ok = batcher.batch(address(token), to, amounts);

        for (uint256 i; i < n; ++i) {
            assertTrue(ok[i]);
            assertEq(token.balanceOf(to[i]), amounts[i]);
        }
    }

    function test_FailureDoesNotRevertBatch() public {
        address[] memory to = new address[](3);
        to[0] = address(0xA);
        to[1] = address(0xB);
        to[2] = address(0xC);
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 1e6;
        amounts[1] = 2_000_000e6; // exceeds relayer balance -> fails
        amounts[2] = 1e6;

        bool[] memory ok = batcher.batch(address(token), to, amounts);

        assertTrue(ok[0]);
        assertFalse(ok[1]);
        assertTrue(ok[2]);
        assertEq(token.balanceOf(to[0]), 1e6);
        assertEq(token.balanceOf(to[1]), 0);
        assertEq(token.balanceOf(to[2]), 1e6);
    }

    function testOnlyOwner() public {
        address[] memory to = new address[](1);
        to[0] = address(0xA);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1e6;

        vm.prank(address(0xBEEF));
        vm.expectRevert(Batcher.NotOwner.selector);
        batcher.batch(address(token), to, amounts);
    }

    function testLengthMismatch() public {
        address[] memory to = new address[](2);
        uint256[] memory amounts = new uint256[](1);
        vm.expectRevert(Batcher.LengthMismatch.selector);
        batcher.batch(address(token), to, amounts);
    }

    function testRescue() public {
        token.mint(address(batcher), 5e6);
        batcher.rescue(address(token), address(0xD), 5e6);
        assertEq(token.balanceOf(address(0xD)), 5e6);
    }

    /// @dev Headline number: gas per payment, 10 individual txs vs one batch of 10.
    ///      Intrinsic 21,000 per tx is included by sending real transactions
    ///      from a pranked EOA... forge doesn't charge intrinsic gas in tests,
    ///      so we add it explicitly in the comparison printed below.
    function testGasComparison() public {
        uint256 n = 10;

        // 10 individual transfers (execution gas only; +21,000 intrinsic each on-chain)
        uint256 gasSingles;
        {
            address[] memory to = _recipients(n, 0);
            uint256[] memory amounts = _amounts(n);
            uint256 g0 = gasleft();
            for (uint256 i; i < n; ++i) {
                token.transfer(to[i], amounts[i]);
            }
            gasSingles = g0 - gasleft();
        }

        // One batch of 10 (execution gas only; +21,000 intrinsic once on-chain)
        uint256 gasBatch;
        {
            address[] memory to = _recipients(n, 1000);
            uint256[] memory amounts = _amounts(n);
            uint256 g0 = gasleft();
            batcher.batch(address(token), to, amounts);
            gasBatch = g0 - gasleft();
        }

        uint256 intrinsic = 21_000;
        uint256 singlesTotal = gasSingles + n * intrinsic;
        uint256 batchTotal = gasBatch + intrinsic;

        console2.log("payments:                  ", n);
        console2.log("singles exec gas:          ", gasSingles);
        console2.log("batch exec gas:            ", gasBatch);
        console2.log("singles total (w/ intr.):  ", singlesTotal);
        console2.log("batch total (w/ intr.):    ", batchTotal);
        console2.log("gas saved per payment:     ", (singlesTotal - batchTotal) / n);
        console2.log("pct saved:                 ", (singlesTotal - batchTotal) * 100 / singlesTotal);
    }
}

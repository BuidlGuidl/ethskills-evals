// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {console2} from "forge-std/console2.sol";
import {RelayBatcher} from "../src/RelayBatcher.sol";

/// Standard OZ-style ERC-20: reverts on failure, returns true otherwise.
contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    string public name = "Mock";

    function mint(address to, uint256 amt) external {
        balanceOf[to] += amt;
    }

    function approve(address spender, uint256 amt) external returns (bool) {
        allowance[msg.sender][spender] = amt;
        return true;
    }

    function transferFrom(address from, address to, uint256 amt) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        require(a >= amt, "insufficient allowance");
        require(balanceOf[from] >= amt, "insufficient balance");
        if (a != type(uint256).max) allowance[from][msg.sender] = a - amt;
        balanceOf[from] -= amt;
        balanceOf[to] += amt;
        return true;
    }
}

/// Always reverts: simulates a blacklisted recipient or defunct token.
contract RevertingToken {
    function transferFrom(address, address, uint256) external pure returns (bool) {
        revert("token reverted");
    }
}

/// Returns false without reverting: non-standard but seen in the wild.
contract FalseReturnToken {
    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }
}

contract RelayBatcherTest is Test {
    RelayBatcher batcher;
    MockERC20 token;
    address relayer = makeAddr("relayer");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    uint256 constant AMT = 1e6;

    function setUp() public {
        batcher = new RelayBatcher();
        token = new MockERC20();
        token.mint(relayer, 1_000_000 * AMT);
        vm.prank(relayer);
        token.approve(address(batcher), type(uint256).max);
    }

    function _addrs() internal view returns (address[] memory a) {
        a = new address[](3);
        a[0] = alice;
        a[1] = bob;
        a[2] = carol;
    }

    function _amts() internal pure returns (uint256[] memory m) {
        m = new uint256[](3);
        m[0] = AMT;
        m[1] = 2 * AMT;
        m[2] = 3 * AMT;
    }

    function test_pays_every_recipient() public {
        vm.prank(relayer);
        uint256[] memory failures = batcher.batchTransfer(address(token), _addrs(), _amts());
        assertEq(token.balanceOf(alice), AMT);
        assertEq(token.balanceOf(bob), 2 * AMT);
        assertEq(token.balanceOf(carol), 3 * AMT);
        assertEq(failures.length, 1);
        assertEq(failures[0], 0); // no bits set
    }

    function test_reverting_item_is_skipped_and_reported() public {
        RevertingToken bad = new RevertingToken();
        vm.prank(relayer);
        uint256[] memory failures = batcher.batchTransfer(address(bad), _addrs(), _amts()); // no approval -> all fail
        assertEq(failures[0], 7); // 3 bits set
    }

    function test_false_return_counts_as_failure() public {
        // one real token payment alongside a token that returns false:
        // relayer has no MockERC20 allowance here, so those items fail too
        FalseReturnToken bad = new FalseReturnToken();
        vm.prank(relayer);
        uint256[] memory failures = batcher.batchTransfer(address(bad), _addrs(), _amts());
        assertEq(failures[0], 7);
    }

    function test_no_allowance_fails_items_without_revert() public {
        // tokens but no approval to the batcher: every item is skipped,
        // nothing reverts, no funds move, and failures are reported
        address other = makeAddr("other");
        vm.startPrank(other);
        MockERC20 otherToken = new MockERC20();
        otherToken.mint(other, 1_000 * AMT);
        vm.expectEmit(true, false, false, true);
        emit RelayBatcher.PaymentFailed(1);
        vm.expectEmit(true, true, false, true);
        emit RelayBatcher.Batch(address(otherToken), other, 3, 3);
        uint256[] memory failures = batcher.batchTransfer(address(otherToken), _addrs(), _amts());
        assertEq(failures[0], 7);
        assertEq(otherToken.balanceOf(other), 1_000 * AMT);
        vm.stopPrank();
    }

    function test_length_mismatch_reverts() public {
        uint256[] memory bad = new uint256[](2);
        vm.prank(relayer);
        vm.expectRevert(RelayBatcher.LengthMismatch.selector);
        batcher.batchTransfer(address(token), _addrs(), bad);
    }

    function test_empty_batch_reverts() public {
        vm.prank(relayer);
        vm.expectRevert(RelayBatcher.EmptyBatch.selector);
        batcher.batchTransfer(address(token), new address[](0), new uint256[](0));
    }

    function test_over_max_batch_reverts() public {
        address[] memory a = new address[](501);
        uint256[] memory m = new uint256[](501);
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(RelayBatcher.BatchTooLarge.selector, 501));
        batcher.batchTransfer(address(token), a, m);
    }

    function test_atomic_reverts_wholesale_on_failure() public {
        address[] memory a = new address[](2);
        uint256[] memory m = new uint256[](2);
        a[0] = alice;
        a[1] = bob;
        m[0] = AMT;
        m[1] = AMT;
        RevertingToken bad = new RevertingToken();
        vm.prank(relayer);
        vm.expectRevert(); // token reverts on every transferFrom
        batcher.batchTransferAtomic(address(bad), a, m);
        // and atomic pays everyone when all succeed
        vm.prank(relayer);
        batcher.batchTransferAtomic(address(token), a, m);
        assertEq(token.balanceOf(alice), AMT);
        assertEq(token.balanceOf(bob), AMT);
    }

    function test_only_caller_funds_can_move() public {
        // a stranger calling the batcher cannot move the relayer's tokens:
        // transferFrom pulls from msg.sender, and stranger has no balance
        address stranger = makeAddr("stranger");
        vm.prank(stranger);
        uint256[] memory failures = batcher.batchTransfer(address(token), _addrs(), _amts());
        assertEq(failures[0], 7); // stranger's items all fail
        assertEq(token.balanceOf(relayer), 1_000_000 * AMT); // relayer untouched
    }

    /// Gas regression lock: per-item cost of a 100-payment batch on the mock
    /// must stay far below the ~62.6k of a standalone transfer (measured on a
    /// Base fork against real USDC, see test/BaseFork.t.sol).
    function test_gas_per_item_batch_100() public {
        uint256 n = 100;
        address[] memory a = new address[](n);
        uint256[] memory m = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            a[i] = address(uint160(0xBEEF + i));
            m[i] = AMT;
        }
        vm.prank(relayer);
        uint256 g0 = gasleft();
        batcher.batchTransfer(address(token), a, m);
        uint256 spent = g0 - gasleft();
        console2.log("batchTransfer N=100 total gas:", spent);
        console2.log("per item:", spent / n);
        assertLt(spent / n, 45_000);
    }
}

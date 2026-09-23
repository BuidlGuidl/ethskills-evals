// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/BatchTokenTransfer.sol";

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function approve(address spender, uint256 value) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public blocked;

    constructor() {
        balanceOf[msg.sender] = 1e12;
    }

    function transfer(address to, uint256 v) external returns (bool) {
        require(!blocked[to], "blocked");
        balanceOf[msg.sender] -= v;
        balanceOf[to] += v;
        return true;
    }

    function transferFrom(address f, address to, uint256 v) external returns (bool) {
        require(!blocked[to], "blocked");
        allowance[f][msg.sender] -= v;
        balanceOf[f] -= v;
        balanceOf[to] += v;
        return true;
    }

    function approve(address s, uint256 v) external returns (bool) {
        allowance[msg.sender][s] = v;
        return true;
    }

    function blockMe(address a) external {
        blocked[a] = true;
    }
}

contract BatchTokenTransferTest is Test {
    // Base mainnet values for the forked benchmark.
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant HOLDER = 0x2192bc3B4028acC1113f2Cd9Ac2Cba70c36520DB;

    BatchTokenTransfer batcher;
    uint256 constant INTRINSIC = 21_000;

    function setUp() public {
        batcher = new BatchTokenTransfer();
    }

    /// Measure execution gas of one direct USDC.transfer on a Base fork.
    function _execSingle() internal returns (uint256 execGas) {
        vm.prank(HOLDER);
        uint256 before = gasleft();
        IERC20(USDC).transfer(address(0xBEEF), 1_000);
        execGas = before - gasleft();
    }

    /// Measure execution gas of one batch of `n` USDC transfers.
    function _execBatch(uint256 n) internal returns (uint256 execGas) {
        address[] memory recipients = new address[](n);
        uint256[] memory amounts = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            recipients[i] = address(uint160(i + 0x1000));
            amounts[i] = 1_000;
        }
        vm.prank(HOLDER);
        IERC20(USDC).approve(address(batcher), type(uint256).max);
        vm.prank(HOLDER);
        uint256 before = gasleft();
        batcher.batchTransfer(USDC, recipients, amounts);
        execGas = before - gasleft();
    }

    function testForkBenchmark() public {
        vm.createSelectFork("https://mainnet.base.org");
        batcher = new BatchTokenTransfer();
        uint256 single = _execSingle();
        emit log_named_uint("single transfer execution gas (excl. 21k intrinsic)", single);
        for (uint256 n = 1; n <= 50; n = n == 1 ? 5 : n == 5 ? 10 : n == 10 ? 20 : n == 20 ? 50 : 51) {
            uint256 exec = _execBatch(n);
            uint256 singlesTotal = n * (INTRINSIC + single);
            uint256 batchTotal = INTRINSIC + exec;
            int256 savedPct = 100 * (int256(singlesTotal) - int256(batchTotal)) / int256(singlesTotal);
            emit log_named_uint("batch size", n);
            emit log_named_uint("batch execution gas", exec);
            emit log_named_uint("batch per-payment gas (incl. amortized intrinsic)", batchTotal / n);
            emit log_named_int("saved vs one-tx-per-payment (%)", savedPct);
        }
    }

    function testSkipsBadRecipients() public {
        MockERC20 token = new MockERC20();
        address good1 = address(0x1);
        address bad = address(0x2);
        address good2 = address(0x3);
        token.blockMe(bad);
        token.approve(address(batcher), 1e12);

        address[] memory r = new address[](3);
        r[0] = good1;
        r[1] = bad;
        r[2] = good2;
        uint256[] memory a = new uint256[](3);
        a[0] = 10;
        a[1] = 20;
        a[2] = 30;

        uint256 succeeded = batcher.batchTransfer(address(token), r, a);
        assertEq(succeeded, 2, "bad recipient must be skipped, not revert the batch");
        assertEq(token.balanceOf(good1), 10);
        assertEq(token.balanceOf(good2), 30);
    }

    function testRevertsOnLengthMismatch() public {
        address[] memory r = new address[](1);
        uint256[] memory a = new uint256[](2);
        vm.expectRevert("BatchTokenTransfer: length mismatch");
        batcher.batchTransfer(address(0), r, a);
    }
}

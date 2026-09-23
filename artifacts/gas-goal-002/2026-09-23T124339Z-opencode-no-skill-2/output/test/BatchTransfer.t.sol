// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BatchTransfer} from "../src/BatchTransfer.sol";
import {MockERC20} from "../src/MockERC20.sol";

interface Vm {
    function prank(address) external;
    function expectRevert() external;
    function expectRevert(bytes4) external;
}

contract BatchTransferTest {
    Vm internal constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    uint256 internal constant N = 50;
    // L2 costs NOT visible to gasleft() inside a test: tx intrinsic + calldata.
    uint256 internal constant TX_INTRINSIC = 21_000;
    uint256 internal constant CALLDATA_BYTE_GAS = 16; // nonzero byte (EIP-2028)

    MockERC20 internal token;
    BatchTransfer internal batcher;
    address internal relayer = address(0xE1A);

    address[] internal recipients;
    uint256[] internal amounts;

    function setUp() public {
        token = new MockERC20();
        batcher = new BatchTransfer();
        token.mint(relayer, 1e15);
        vm.prank(relayer);
        token.approve(address(batcher), type(uint256).max);

        for (uint256 i; i < N; ++i) {
            recipients.push(address(uint160(0xBEEF0000 + i * 7)));
            amounts.push(1_000_000 + i * 13_337); // nonzero amounts
        }
    }

    function _packed() internal view returns (bytes memory packed) {
        for (uint256 i; i < N; ++i) {
            packed = bytes.concat(packed, bytes20(recipients[i]), bytes16(uint128(amounts[i])));
        }
    }

    /// @dev Execution gas of N standalone transfer() calls (excludes 21k intrinsic + calldata).
    function _individualGas() internal returns (uint256 exec, uint256 total) {
        for (uint256 i; i < N; ++i) {
            uint256 g = gasleft();
            vm.prank(relayer);
            token.transfer(recipients[i], amounts[i]);
            exec += g - gasleft();
        }
        // Each standalone tx: 21,000 intrinsic + 68 bytes of transfer() calldata.
        total = exec + N * (TX_INTRINSIC + 68 * CALLDATA_BYTE_GAS);
    }

    /// @dev Execution gas of one batchTransfer() of N payments (excludes intrinsic + calldata).
    function _batchGas() internal returns (uint256 exec, uint256 total) {
        bytes memory packed = _packed();
        uint256 g = gasleft();
        batcher.batchTransfer(address(token), relayer, packed);
        exec = g - gasleft();
        total = exec + TX_INTRINSIC + packed.length * CALLDATA_BYTE_GAS;
    }

    function testIndividualTransfers50() public returns (uint256) {
        (uint256 exec, uint256 total) = _individualGas();
        emit Gas("individual x50 execution", exec);
        emit Gas("individual x50 total    ", total);
        return total;
    }

    function testBatchTransfer50() public returns (uint256) {
        (uint256 exec, uint256 total) = _batchGas();
        emit Gas("batch x50 execution     ", exec);
        emit Gas("batch x50 total         ", total);
        // correctness: every recipient got paid
        for (uint256 i; i < N; ++i) {
            require(token.balanceOf(recipients[i]) == amounts[i], "wrong balance");
        }
        return total;
    }

    /// @dev Second batch to the SAME recipients: storage is warm/nonzero, cheaper still.
    function testBatchTransfer50Repeat() public returns (uint256) {
        _batchGas(); // first batch makes recipient balances nonzero
        (uint256 exec, uint256 total) = _batchGas();
        emit Gas("batch x50 repeat exec   ", exec);
        emit Gas("batch x50 repeat total  ", total);
        return total;
    }

    function testBatchSavesAtLeast40Percent() public {
        (, uint256 indTotal) = _individualGas();
        // Batch to a FRESH set of recipients so both sides pay cold storage costs.
        bytes memory packed;
        for (uint256 i; i < N; ++i) {
            packed = bytes.concat(
                packed, bytes20(address(uint160(0xCAFE0000 + i * 7))), bytes16(uint128(amounts[i]))
            );
        }
        uint256 g = gasleft();
        batcher.batchTransfer(address(token), relayer, packed);
        uint256 batchTotal = (g - gasleft()) + TX_INTRINSIC + packed.length * CALLDATA_BYTE_GAS;
        emit Gas("saving bps (cold v cold)", 10_000 - (batchTotal * 10_000) / indTotal);
        require(batchTotal * 100 < indTotal * 60, "batch must save >= 40%");
    }

    function testRevertsOnBadLength() public {
        vm.expectRevert(BatchTransfer.BadLength.selector);
        batcher.batchTransfer(address(token), relayer, hex"1234");
    }

    function testRevertsForNonOwner() public {
        vm.prank(address(0xBAD));
        vm.expectRevert(BatchTransfer.NotOwner.selector);
        batcher.batchTransfer(address(token), relayer, _packed());
    }

    function testRevertsOnInsufficientBalance() public {
        address poor = address(0x900D);
        token.mint(poor, 10);
        vm.prank(poor);
        token.approve(address(batcher), type(uint256).max);
        vm.expectRevert();
        batcher.batchTransfer(address(token), poor, _packed());
    }

    event Gas(string label, uint256 value);
}

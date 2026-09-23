// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BatchTransfer} from "../contracts/BatchTransfer.sol";

/// Minimal cheatcode interface (avoids the forge-std dependency).
interface Vm {
    function prank(address) external;
}

Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

contract MockERC20 {
    string public name = "Mock";
    uint8 public decimals = 6;
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
        if (allowance[from][msg.sender] != type(uint256).max) {
            allowance[from][msg.sender] -= amount;
        }
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract BatchTransferTest {
    MockERC20 token;
    BatchTransfer batcher;
    address relayer = address(this);

    function setUp() public {
        token = new MockERC20();
        batcher = new BatchTransfer();
        token.mint(relayer, 1_000_000_000e6);
        token.approve(address(batcher), type(uint256).max);
    }

    function test_batchTransfer_distributes() public {
        address[] memory to = new address[](3);
        uint256[] memory amt = new uint256[](3);
        for (uint256 i; i < 3; i++) {
            to[i] = address(uint160(i + 100));
            amt[i] = (i + 1) * 1e6;
        }
        uint256 total = batcher.batchTransfer(address(token), to, amt);
        assert(total == 6e6);
        for (uint256 i; i < 3; i++) {
            assert(token.balanceOf(to[i]) == amt[i]);
        }
    }

    function test_batchPacked_distributes() public {
        // Each 32-byte word: [20-byte address][12-byte uint96 amount]
        bytes memory packed = abi.encodePacked(
            address(uint160(0xA1)), uint96(5e6),
            address(uint160(0xA2)), uint96(7e6)
        );
        uint256 total = batcher.batchPacked(address(token), packed);
        assert(total == 12e6);
        assert(token.balanceOf(address(uint160(0xA1))) == 5e6);
        assert(token.balanceOf(address(uint160(0xA2))) == 7e6);
    }

    function test_onlyOwner() public {
        address[] memory to = new address[](1);
        uint256[] memory amt = new uint256[](1);
        to[0] = address(1);
        amt[0] = 1;
        vm.prank(address(0xBEEF));
        try batcher.batchTransfer(address(token), to, amt) {
            revert("should have reverted");
        } catch {}
        // owner call still works afterwards
        batcher.batchTransfer(address(token), to, amt);
    }

    function test_badPackedLength_reverts() public {
        bytes memory packed = new bytes(31);
        try batcher.batchPacked(address(token), packed) {
            revert("should have reverted");
        } catch {}
    }

    /// Gas measurement: batch of N packed transfers, one tx.
    function test_gas_batchPacked50() public {
        uint256 n = 50;
        bytes memory packed = new bytes(n * 32);
        for (uint256 i; i < n; i++) {
            bytes32 word = bytes32((uint256(uint160(0x1000 + i)) << 96) | uint96(1e6));
            assembly {
                mstore(add(add(packed, 32), mul(i, 32)), word)
            }
        }
        uint256 g0 = gasleft();
        batcher.batchPacked(address(token), packed);
        uint256 used = g0 - gasleft();
        // Marginal cost per transfer to a *fresh* recipient is dominated by
        // the 20,000 gas zero->nonzero SSTORE + 2,600 cold-account access,
        // which a standalone transfer also pays. Batching eliminates the
        // ~21,000 gas intrinsic + most of the L1 data fee on top of this,
        // so assert the batch's marginal cost stays below the standalone
        // execution+intrinsic floor (~50,000 gas).
        assert(used / n < 30_000);
    }
}

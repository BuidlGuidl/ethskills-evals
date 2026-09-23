// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BatchTransfer, IERC20} from "../contracts/BatchTransfer.sol";

interface Vm {
    function prank(address) external;
    function toString(uint256) external returns (string memory);
}

Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

/// Minimal ERC-20 with USDC-like transfer semantics (balance slots, no fee).
contract MockERC20 {
    string public name = "Mock USD";
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
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a != type(uint256).max) allowance[from][msg.sender] = a - amount;
        _move(from, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) internal {
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }
}

/// Measures per-payment execution gas: individual transfer() vs BatchTransfer.
/// Run: forge test -vv
contract BatchTransferGasTest {
    event log_named_uint(string key, uint256 val);

    MockERC20 token;
    BatchTransfer batch;
    address relayer = address(0x0B055);

    function setUp() public {
        token = new MockERC20();
        batch = new BatchTransfer();
        token.mint(relayer, 1_000_000_000e6);
        vm.prank(relayer);
        token.approve(address(batch), type(uint256).max);
    }

    function _recipients(uint256 n, bool prefunded) internal returns (address[] memory tos) {
        tos = new address[](n);
        for (uint256 i; i < n; i++) {
            tos[i] = address(uint160(0x100000 + i));
            if (prefunded) token.mint(tos[i], 1); // existing holder: warm storage slot
        }
    }

    function _single(address to) internal returns (uint256) {
        vm.prank(relayer);
        uint256 g = gasleft();
        token.transfer(to, 100e6);
        return g - gasleft();
    }

    function _batch(address[] memory tos, uint256[] memory amts) internal returns (uint256) {
        vm.prank(relayer);
        uint256 g = gasleft();
        batch.batchTransfer(address(token), tos, amts);
        return g - gasleft();
    }

    function test_gas_single_prefunded() public {
        address[] memory tos = _recipients(1, true);
        emit log_named_uint("single transfer, existing holder (gas)", _single(tos[0]));
    }

    function test_gas_single_fresh() public {
        address[] memory tos = _recipients(1, false);
        emit log_named_uint("single transfer, fresh address (gas)", _single(tos[0]));
    }

    function test_gas_batches_prefunded() public {
        uint256[4] memory sizes = [uint256(5), 10, 25, 50];
        for (uint256 s; s < sizes.length; s++) {
            uint256 n = sizes[s];
            address[] memory tos = _recipients(n, true);
            uint256[] memory amts = new uint256[](n);
            for (uint256 i; i < n; i++) amts[i] = 100e6;
            uint256 gasUsed = _batch(tos, amts);
            emit log_named_uint(string.concat("batch size, existing holders: ", vm.toString(n)), n);
            emit log_named_uint("  total gas", gasUsed);
            emit log_named_uint("  gas per payment", gasUsed / n);
        }
    }

    function test_gas_batches_fresh() public {
        uint256[2] memory sizes = [uint256(10), 25];
        for (uint256 s; s < sizes.length; s++) {
            uint256 n = sizes[s];
            address[] memory tos = _recipients(n, false);
            uint256[] memory amts = new uint256[](n);
            for (uint256 i; i < n; i++) amts[i] = 100e6;
            uint256 gasUsed = _batch(tos, amts);
            emit log_named_uint(string.concat("batch size, fresh addresses: ", vm.toString(n)), n);
            emit log_named_uint("  total gas", gasUsed);
            emit log_named_uint("  gas per payment", gasUsed / n);
        }
    }
}

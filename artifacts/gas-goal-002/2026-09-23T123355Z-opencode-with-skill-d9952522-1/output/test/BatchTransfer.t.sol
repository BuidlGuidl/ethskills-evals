// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../contracts/BatchTransfer.sol";
import "forge-std/Test.sol";

/// Minimal ERC-20 with real storage costs (balances as mapping, like USDC).
contract MockERC20 {
    string public name = "Mock USD";
    string public symbol = "mUSD";
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
        return _move(msg.sender, to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "allowance");
            allowance[from][msg.sender] = allowed - amount;
        }
        return _move(from, to, amount);
    }

    function _move(address from, address to, uint256 amount) internal returns (bool) {
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

contract BatchTransferGasTest is Test {
    MockERC20 token;
    BatchTransfer batcher;
    address relayer = address(0xA11CE);

    uint256 constant N = 50;
    address[N] recipients;
    uint256[N] amounts;

    function setUp() public {
        token = new MockERC20();
        batcher = new BatchTransfer(); // owner = address(this); relayer pattern below uses prank
        token.mint(relayer, 1_000_000e6);
        // Distinct recipients that already hold a balance = the common
        // payments-app case (warm-ish recipient slots, realistic SSTORE cost).
        for (uint256 i = 0; i < N; ++i) {
            recipients[i] = address(uint160(0x1000 + i));
            amounts[i] = 10e6;
            token.mint(recipients[i], 1);
        }
        vm.prank(relayer);
        token.approve(address(batcher), type(uint256).max);
    }

    function _toArray(uint256 n) internal view returns (address[] memory r, uint256[] memory a) {
        r = new address[](n);
        a = new uint256[](n);
        for (uint256 i = 0; i < n; ++i) {
            r[i] = recipients[i];
            a[i] = amounts[i];
        }
    }

    /// Execution gas of one plain token.transfer from an EOA (no 21k intrinsic).
    function test_standaloneTransferExecGas() public {
        vm.prank(relayer);
        uint256 g0 = gasleft();
        token.transfer(recipients[0], amounts[0]);
        uint256 used = g0 - gasleft();
        emit log_named_uint("standalone transfer() execution gas (excl. 21k intrinsic + calldata)", used);
    }

    /// Batched: total execution gas for N transfers, and marginal per transfer.
    function test_batchGas() public {
        BatchTransfer b = new BatchTransfer(); // owner = this test contract
        token.mint(address(this), 1_000_000e6);
        token.approve(address(b), type(uint256).max);

        (address[] memory r1, uint256[] memory a1) = _toArray(1);
        uint256 g1 = gasleft();
        b.batchTransfer(address(token), r1, a1);
        uint256 used1 = g1 - gasleft();

        (address[] memory rN, uint256[] memory aN) = _toArray(N);
        uint256 gN = gasleft();
        b.batchTransfer(address(token), rN, aN);
        uint256 usedN = gN - gasleft();

        uint256 marginal = (usedN - used1) / (N - 1);
        emit log_named_uint("batch(1) execution gas", used1);
        emit log_named_uint("batch(N) execution gas", usedN);
        emit log_named_uint("batch marginal gas per transfer", marginal);
    }

    function test_batchMovesFunds() public {
        BatchTransfer b = new BatchTransfer();
        token.mint(address(this), 1_000_000e6);
        token.approve(address(b), type(uint256).max);
        (address[] memory rN, uint256[] memory aN) = _toArray(N);
        uint256 before0 = token.balanceOf(recipients[0]);
        b.batchTransfer(address(token), rN, aN);
        assertEq(token.balanceOf(recipients[0]), before0 + amounts[0]);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console2 as console} from "forge-std/Test.sol";
import {BatchRelayer} from "../src/BatchRelayer.sol";

contract MockERC20 {
    mapping(address => uint256) public balances;

    function mint(address to, uint256 amount) external {
        balances[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        uint256 bal = balances[msg.sender];
        require(bal >= amount, "insufficient");
        balances[msg.sender] = bal - amount;
        balances[to] += amount;
        return true;
    }
}

contract NonStandardToken {
    mapping(address => uint256) public balances;

    function mint(address to, uint256 amount) external {
        balances[to] += amount;
    }

    function transfer(address to, uint256 amount) external {
        uint256 bal = balances[msg.sender];
        require(bal >= amount, "insufficient");
        balances[msg.sender] = bal - amount;
        balances[to] += amount;
    }
}

contract FailingToken {
    function transfer(address, uint256) external pure returns (bool) {
        revert("nope");
    }
}

contract BatchRelayerTest is Test {
    BatchRelayer relayer;
    MockERC20 token;
    NonStandardToken nonStandard;
    FailingToken failing;

    address owner = makeAddr("owner");
    address attacker = makeAddr("attacker");

    uint256 constant AMOUNT = 1 ether;

    function setUp() public {
        vm.prank(owner);
        relayer = new BatchRelayer();
        token = new MockERC20();
        nonStandard = new NonStandardToken();
        failing = new FailingToken();
    }

    function _recipient(uint256 i) internal pure returns (address) {
        return address(uint160(0xA11CE + i));
    }

    function _fund(MockERC20 t, uint256 n) internal {
        uint256 total = n * AMOUNT;
        t.mint(address(relayer), total);
    }

    function _recipients(uint256 n) internal pure returns (address[] memory arr) {
        arr = new address[](n);
        for (uint256 i = 0; i < n; ++i) {
            arr[i] = _recipient(i);
        }
    }

    function _amounts(uint256 n) internal pure returns (uint256[] memory arr) {
        arr = new uint256[](n);
        for (uint256 i = 0; i < n; ++i) {
            arr[i] = AMOUNT;
        }
    }

    function test_ownerIsDeployer() public view {
        assertEq(relayer.owner(), owner);
    }

    function test_batchTransferPaysEveryRecipient() public {
        uint256 n = 5;
        _fund(token, n);
        vm.prank(owner);
        relayer.batchTransfer(address(token), _recipients(n), _amounts(n));
        for (uint256 i = 0; i < n; ++i) {
            assertEq(token.balances(_recipient(i)), AMOUNT);
        }
        assertEq(token.balances(address(relayer)), 0);
    }

    function test_batchTransferMultiMixedTokens() public {
        uint256 n = 4;
        token.mint(address(relayer), 2 * AMOUNT);
        nonStandard.mint(address(relayer), 2 * AMOUNT);
        address[] memory tokens = new address[](n);
        address[] memory recs = new address[](n);
        uint256[] memory amts = new uint256[](n);
        for (uint256 i = 0; i < n; ++i) {
            tokens[i] = (i % 2 == 0) ? address(token) : address(nonStandard);
            recs[i] = _recipient(i);
            amts[i] = AMOUNT;
        }
        vm.prank(owner);
        relayer.batchTransferMulti(tokens, recs, amts);
        for (uint256 i = 0; i < n; ++i) {
            assertEq(MockERC20(tokens[i]).balances(_recipient(i)), AMOUNT);
        }
    }

    function test_nonOwnerCannotBatch() public {
        vm.prank(attacker);
        vm.expectRevert(BatchRelayer.NotOwner.selector);
        relayer.batchTransfer(address(token), _recipients(1), _amounts(1));
    }

    function test_nonOwnerCannotWithdrawOrTransferOwnership() public {
        vm.startPrank(attacker);
        vm.expectRevert(BatchRelayer.NotOwner.selector);
        relayer.withdraw(address(token), attacker, 1);
        vm.expectRevert(BatchRelayer.NotOwner.selector);
        relayer.transferOwnership(attacker);
        vm.stopPrank();
    }

    function test_arrayMismatchReverts() public {
        vm.prank(owner);
        vm.expectRevert(BatchRelayer.ArrayMismatch.selector);
        relayer.batchTransfer(address(token), _recipients(3), _amounts(2));
        vm.prank(owner);
        vm.expectRevert(BatchRelayer.ArrayMismatch.selector);
        relayer.batchTransfer(address(token), new address[](0), new uint256[](0));
    }

    function test_nonStandardTokenSupported() public {
        uint256 n = 2;
        nonStandard.mint(address(relayer), n * AMOUNT);
        vm.prank(owner);
        relayer.batchTransfer(address(nonStandard), _recipients(n), _amounts(n));
        assertEq(nonStandard.balances(_recipient(0)), AMOUNT);
        assertEq(nonStandard.balances(_recipient(1)), AMOUNT);
    }

    function test_failingTransferRevertsAtIndex() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(BatchRelayer.TransferFailed.selector, 0));
        relayer.batchTransfer(address(failing), _recipients(1), _amounts(1));
    }

    function test_withdrawRecoversFloat() public {
        uint256 n = 3;
        _fund(token, n);
        address sink = makeAddr("sink");
        vm.prank(owner);
        relayer.withdraw(address(token), sink, n * AMOUNT);
        assertEq(token.balances(sink), n * AMOUNT);
    }

    function test_transferOwnership() public {
        address next = makeAddr("next");
        vm.prank(owner);
        relayer.transferOwnership(next);
        assertEq(relayer.owner(), next);
    }

    function _freshRecipient(uint256 i) internal pure returns (address) {
        return address(uint160(0xF00D0000 + i));
    }

    function test_gas_standaloneTransfer() public {
        token.mint(address(this), 2 * AMOUNT);

        uint256 g0 = gasleft();
        token.transfer(_recipient(0), AMOUNT);
        uint256 firstExec = g0 - gasleft();

        uint256 n = 20;
        token.mint(address(this), n * AMOUNT);
        uint256 g1 = gasleft();
        for (uint256 i = 1; i <= n; ++i) {
            token.transfer(_recipient(i), AMOUNT);
        }
        uint256 warmExec = (g1 - gasleft()) / n;

        console.log("HARNESS_STANDALONE_EXEC_FIRST_CALL:", firstExec);
        console.log("HARNESS_STANDALONE_EXEC_WARM_AVG:", warmExec);
    }

    function test_gas_batchMarginal() public {
        uint256 large = 101;
        _fund(token, large + 2);

        address[] memory warmup = new address[](1);
        warmup[0] = address(uint160(0xBAD0001));
        uint256[] memory one = _amounts(1);
        vm.prank(owner);
        relayer.batchTransfer(address(token), warmup, one);

        uint256 g0 = gasleft();
        address[] memory r2 = new address[](1);
        r2[0] = address(uint160(0xBAD0002));
        vm.prank(owner);
        relayer.batchTransfer(address(token), r2, one);
        uint256 smallGas = g0 - gasleft();

        address[] memory many = new address[](large);
        uint256[] memory manyAmts = new uint256[](large);
        for (uint256 i = 0; i < large; ++i) {
            many[i] = _freshRecipient(i);
            manyAmts[i] = AMOUNT;
        }
        uint256 g1 = gasleft();
        vm.prank(owner);
        relayer.batchTransfer(address(token), many, manyAmts);
        uint256 largeGas = g1 - gasleft();

        uint256 marginal = (largeGas - smallGas) / (large - 1);
        uint256 avgAt101 = largeGas / large;

        console.log("HARNESS_BATCH_TX_GAS_1_TRANSFER:", smallGas);
        console.log("HARNESS_BATCH_TX_GAS_101_TRANSFERS:", largeGas);
        console.log("HARNESS_BATCH_MARGINAL_PER_TRANSFER:", marginal);
        console.log("HARNESS_BATCH_AVG_PER_TRANSFER_AT_101:", avgAt101);
    }
}
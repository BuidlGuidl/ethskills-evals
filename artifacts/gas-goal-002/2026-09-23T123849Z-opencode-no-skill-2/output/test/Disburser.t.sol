// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { console2 } from "forge-std/console2.sol";
import { Vm } from "forge-std/Vm.sol";
import { Disburser } from "../src/Disburser.sol";

contract MockUSDC {
    event Transfer(address indexed from, address indexed to, uint256 value);

    string public name = "USD Coin";
    uint8 public decimals = 6;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public blacklist;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function setBlacklist(address account, bool value) external {
        blacklist[account] = value;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(!blacklist[msg.sender] && !blacklist[to], "blacklisted");
        uint256 fromBalance = balanceOf[msg.sender];
        require(fromBalance >= amount, "insufficient balance");
        balanceOf[msg.sender] = fromBalance - amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "insufficient allowance");
        allowance[from][msg.sender] = allowed - amount;
        require(!blacklist[from] && !blacklist[to], "blacklisted");
        uint256 fromBalance = balanceOf[from];
        require(fromBalance >= amount, "insufficient balance");
        balanceOf[from] = fromBalance - amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

contract DisburserTest is Test {
    event Disbursed(
        address indexed token, address indexed caller, uint256 attempted, uint256 succeeded, uint256 amount
    );
    event TransferFailed(address indexed token, uint256 indexed index, address recipient, uint256 amount);

    Disburser public disburser;
    MockUSDC public token;
    address public relayer;

    uint256 public constant N = 250;
    uint256 public constant AMOUNT = 1_000_000;
    address public constant GOLDEN_TO = 0x1111111111111111111111111111111111111111;
    uint96 public constant GOLDEN_AMOUNT = 1234567890;

    function setUp() public {
        disburser = new Disburser();
        token = new MockUSDC();
        relayer = makeAddr("relayer");
        token.mint(relayer, 1e24);
        vm.prank(relayer);
        token.approve(address(disburser), type(uint256).max);
        for (uint256 i = 0; i < N; i++) {
            token.mint(_warmRecipient(i), 1);
        }
    }

    function _warmRecipient(uint256 i) internal pure returns (address) {
        return address(uint160(0x10000 + i));
    }

    function _coldRecipient(uint256 i) internal pure returns (address) {
        return address(uint160(0x50000 + i));
    }

    function _pack(address to, uint96 amount) internal pure returns (bytes memory) {
        return abi.encodePacked(to, amount);
    }

    function _packedWarm(uint256 n, uint96 amount) internal pure returns (bytes memory) {
        bytes memory out = new bytes(n * 32);
        for (uint256 i = 0; i < n; i++) {
            bytes32 c = bytes32(abi.encodePacked(_warmRecipient(i), amount));
            assembly {
                mstore(add(add(out, 32), mul(i, 32)), c)
            }
        }
        return out;
    }

    function _packedCold(uint256 n, uint96 amount) internal pure returns (bytes memory) {
        bytes memory out = new bytes(n * 32);
        for (uint256 i = 0; i < n; i++) {
            bytes32 c = bytes32(abi.encodePacked(_coldRecipient(i), amount));
            assembly {
                mstore(add(add(out, 32), mul(i, 32)), c)
            }
        }
        return out;
    }

    function test_GoldenVectorMatchesRelayerPacker() public pure {
        bytes memory chunk = abi.encodePacked(GOLDEN_TO, GOLDEN_AMOUNT);
        assertEq(chunk, hex"11111111111111111111111111111111111111110000000000000000499602d2");
        assertEq(chunk.length, 32);
    }

    function test_WarmBatchDisbursesAll() public {
        bytes memory packed = _packedWarm(N, uint96(AMOUNT));
        vm.startPrank(relayer);
        uint256 g0 = gasleft();
        disburser.disburseFrom(address(token), packed, false);
        uint256 batchGas = g0 - gasleft();
        vm.stopPrank();

        for (uint256 i = 0; i < N; i++) {
            assertEq(token.balanceOf(_warmRecipient(i)), AMOUNT + 1);
        }
        assertEq(token.balanceOf(relayer), 1e24 - N * AMOUNT);
        assertEq(token.balanceOf(address(disburser)), 0);
        uint256 perTransfer = batchGas / N;
        console2.log("warm batch total gas:", batchGas);
        console2.log("warm batch per-transfer gas:", perTransfer);
        assertLe(perTransfer, 16000, "warm per-transfer too high");
    }

    function test_ColdBatchDisbursesAll() public {
        bytes memory packed = _packedCold(N, uint96(AMOUNT));
        vm.startPrank(relayer);
        uint256 g0 = gasleft();
        disburser.disburseFrom(address(token), packed, false);
        uint256 batchGas = g0 - gasleft();
        vm.stopPrank();

        for (uint256 i = 0; i < N; i++) {
            assertEq(token.balanceOf(_coldRecipient(i)), AMOUNT);
        }
        assertEq(token.balanceOf(address(disburser)), 0);
        uint256 perTransfer = batchGas / N;
        console2.log("cold batch total gas:", batchGas);
        console2.log("cold batch per-transfer gas:", perTransfer);
        assertLe(perTransfer, 40000, "cold per-transfer too high");
    }

    function test_BaselineStandaloneTransferGas() public {
        vm.startPrank(relayer);
        uint256 g0 = gasleft();
        token.transfer(_warmRecipient(0), AMOUNT);
        uint256 warmExec = g0 - gasleft();
        g0 = gasleft();
        token.transfer(_warmRecipient(0), AMOUNT);
        uint256 warmWarmExec = g0 - gasleft();
        g0 = gasleft();
        token.transfer(_coldRecipient(0), AMOUNT);
        uint256 coldExec = g0 - gasleft();
        vm.stopPrank();

        console2.log("standalone warm exec (no intrinsic):", warmExec);
        console2.log("standalone warm-warm exec (no intrinsic):", warmWarmExec);
        console2.log("standalone warm tx est (exec + 21k intrinsic):", warmExec + 21000);
        console2.log("standalone cold exec (no intrinsic):", coldExec);
        console2.log("standalone cold tx est (exec + 21k intrinsic):", coldExec + 21000);
    }

    function test_BatchFixedOverhead() public {
        bytes memory packed = _packedWarm(1, uint96(AMOUNT));
        vm.startPrank(relayer);
        uint256 g0 = gasleft();
        disburser.disburseFrom(address(token), packed, false);
        uint256 fixedOverhead = g0 - gasleft();
        vm.stopPrank();
        console2.log("batch-of-1 total gas (fixed overhead):", fixedOverhead);
    }

    function test_SafeModeIsolatesFailures() public {
        uint256 packedCount = 5;
        address[5] memory recipients =
            [_warmRecipient(0), _warmRecipient(1), address(0), _warmRecipient(2), _warmRecipient(3)];
        token.setBlacklist(_warmRecipient(2), true);

        bytes memory packed = new bytes(packedCount * 32);
        for (uint256 i = 0; i < packedCount; i++) {
            bytes32 c = bytes32(abi.encodePacked(recipients[i], uint96(AMOUNT)));
            assembly {
                mstore(add(add(packed, 32), mul(i, 32)), c)
            }
        }

        uint256 relayerBefore = token.balanceOf(relayer);

        vm.recordLogs();
        vm.prank(relayer);
        disburser.disburseFrom(address(token), packed, false);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        bytes32 failedTopic = keccak256("TransferFailed(address,uint256,address,uint256)");
        bytes32 disbursedTopic = keccak256("Disbursed(address,address,uint256,uint256,uint256)");
        uint256 failedCount;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(disburser) && logs[i].topics[0] == failedTopic) {
                failedCount++;
                uint256 index = uint256(logs[i].topics[2]);
                (address recipient,) = abi.decode(logs[i].data, (address, uint256));
                if (index == 2) {
                    assertEq(recipient, address(0));
                } else if (index == 3) {
                    assertEq(recipient, _warmRecipient(2));
                } else {
                    revert("unexpected TransferFailed index");
                }
            }
            if (logs[i].emitter == address(disburser) && logs[i].topics[0] == disbursedTopic) {
                (uint256 attempted, uint256 succeeded,) = abi.decode(logs[i].data, (uint256, uint256, uint256));
                assertEq(attempted, 5);
                assertEq(succeeded, 3);
            }
        }
        assertEq(failedCount, 2, "expected exactly two TransferFailed events");

        assertEq(token.balanceOf(_warmRecipient(0)), AMOUNT + 1);
        assertEq(token.balanceOf(_warmRecipient(1)), AMOUNT + 1);
        assertEq(token.balanceOf(_warmRecipient(2)), 1);
        assertEq(token.balanceOf(_warmRecipient(3)), AMOUNT + 1);
        assertEq(token.balanceOf(address(disburser)), 0, "leftover not swept");
        assertEq(token.balanceOf(relayer), relayerBefore - 3 * AMOUNT);
    }

    function test_StrictModeRevertsWholeBatch() public {
        uint256 packedCount = 4;
        address[4] memory recipients = [_warmRecipient(0), _warmRecipient(1), _warmRecipient(2), _warmRecipient(3)];
        token.setBlacklist(_warmRecipient(2), true);

        bytes memory packed = new bytes(packedCount * 32);
        for (uint256 i = 0; i < packedCount; i++) {
            bytes32 c = bytes32(abi.encodePacked(recipients[i], uint96(AMOUNT)));
            assembly {
                mstore(add(add(packed, 32), mul(i, 32)), c)
            }
        }

        uint256 relayerBefore = token.balanceOf(relayer);
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(Disburser.TransferFailedAt.selector, 2));
        disburser.disburseFrom(address(token), packed, true);

        assertEq(token.balanceOf(relayer), relayerBefore);
        for (uint256 i = 0; i < packedCount; i++) {
            uint256 expected = i == 2 ? 1 : 1;
            assertEq(token.balanceOf(recipients[i]), expected);
        }
    }

    function test_StrictModeRejectsZeroRecipient() public {
        bytes memory packed = abi.encodePacked(address(0), uint96(AMOUNT));
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(Disburser.InvalidRecipient.selector, 0));
        disburser.disburseFrom(address(token), packed, true);
    }

    function test_BadPackedLengthReverts() public {
        bytes memory packed = new bytes(33);
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(Disburser.BadPackedLength.selector, 33));
        disburser.disburseFrom(address(token), packed, false);
    }

    function test_EmptyBatchReverts() public {
        vm.prank(relayer);
        vm.expectRevert(Disburser.EmptyBatch.selector);
        disburser.disburseFrom(address(token), "", false);
    }

    function test_PullFailedWhenNoAllowance() public {
        address other = makeAddr("other");
        token.mint(other, 1e18);
        vm.prank(other);
        vm.expectRevert(Disburser.PullFailed.selector);
        disburser.disburseFrom(address(token), abi.encodePacked(_warmRecipient(0), uint96(AMOUNT)), false);
    }

    function test_DisburseOwnRequiresSelfCall() public {
        vm.prank(relayer);
        vm.expectRevert(Disburser.OnlySelf.selector);
        disburser.disburseOwn(address(token), abi.encodePacked(_warmRecipient(0), uint96(AMOUNT)), false);
    }

    function test_EIP7702DelegatedDisburseOwn() public {
        (address relayerEoa, uint256 relayerKey) = makeAddrAndKey("relayer7702");
        token.mint(relayerEoa, 1e18);

        Vm.SignedDelegation memory delegation = vm.signDelegation(address(disburser), relayerKey);
        bytes memory packed = abi.encodePacked(_warmRecipient(0), uint96(AMOUNT));

        uint256 balanceBefore = token.balanceOf(relayerEoa);
        vm.attachDelegation(delegation);
        vm.prank(relayerEoa);
        (bool ok,) =
            relayerEoa.call(abi.encodeWithSelector(Disburser.disburseOwn.selector, address(token), packed, false));
        assertTrue(ok, "7702 delegated disburseOwn failed");
        assertEq(token.balanceOf(_warmRecipient(0)), AMOUNT + 1);
        assertEq(token.balanceOf(relayerEoa), balanceBefore - AMOUNT);
        assertEq(token.balanceOf(address(disburser)), 0);
    }
}

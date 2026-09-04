// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";

interface Vm {
    function prank(address) external;
    function expectRevert(bytes4) external;
    function expectRevert(bytes calldata) external;
}

contract MockUSDC is IERC20 {
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 value) external {
        balanceOf[to] += value;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        return true;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= value, "allowance");
        allowance[from][msg.sender] = allowed - value;
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) private {
        require(balanceOf[from] >= value, "balance");
        balanceOf[from] -= value;
        balanceOf[to] += value;
    }
}

    contract FreelanceEscrowTest {
        Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
        address private constant CLIENT = address(0xC1E17);
        address private constant CONTRACTOR = address(0xC0A7AC70);
        address private constant ARBITER = address(0xA8B17E);
        uint256 private constant AMOUNT = 10_000e6;

        MockUSDC private token;
        FreelanceEscrow private escrow;

        function setUp() public {
            token = new MockUSDC();
            escrow = new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, AMOUNT);
            token.mint(CLIENT, AMOUNT);
            vm.prank(CLIENT);
            token.approve(address(escrow), AMOUNT);
        }

        function testClientCanFundAndReleaseAfterDelivery() public {
            vm.prank(CLIENT);
            escrow.fund();
            vm.prank(CONTRACTOR);
            escrow.acceptJob();
            vm.prank(CONTRACTOR);
            escrow.markDelivered();
            vm.prank(CLIENT);
            escrow.release();

            require(token.balanceOf(CONTRACTOR) == AMOUNT, "contractor was not paid");
            require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Released), "wrong state");
        }

        function testArbiterCanSplitDisputedFunds() public {
            vm.prank(CLIENT);
            escrow.fund();
            vm.prank(CONTRACTOR);
            escrow.raiseDispute();
            vm.prank(ARBITER);
            escrow.resolveDispute(4_000e6, 6_000e6);

            require(token.balanceOf(CLIENT) == 4_000e6, "client award missing");
            require(token.balanceOf(CONTRACTOR) == 6_000e6, "contractor award missing");
        }

        function testClientCanRecoverIfJobIsNotAccepted() public {
            vm.prank(CLIENT);
            escrow.fund();
            vm.prank(CLIENT);
            escrow.refundUnaccepted();

            require(token.balanceOf(CLIENT) == AMOUNT, "client refund missing");
            require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Refunded), "wrong state");
        }

        function testCannotReleaseBeforeDelivery() public {
            vm.prank(CLIENT);
            escrow.fund();
            vm.prank(CLIENT);
            vm.expectRevert(
                abi.encodeWithSelector(
                    FreelanceEscrow.InvalidStatus.selector, FreelanceEscrow.Status.Funded
                )
            );
            escrow.release();
        }

        function testOnlyClientCanFund() public {
            vm.prank(CONTRACTOR);
            vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
            escrow.fund();
        }

        function testRejectsOutOfRangeAmount() public {
            vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
            new FreelanceEscrow(token, CLIENT, CONTRACTOR, ARBITER, 1_999e6);
        }
    }

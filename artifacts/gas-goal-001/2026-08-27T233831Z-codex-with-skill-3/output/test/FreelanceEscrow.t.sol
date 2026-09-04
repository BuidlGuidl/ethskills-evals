// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {FreelanceEscrow, IERC20, IERC20Metadata} from "../src/FreelanceEscrow.sol";

interface Vm {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockUSDC is IERC20Metadata {
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function decimals() external pure returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        return _transfer(msg.sender, to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed < amount) return false;
        allowance[from][msg.sender] = allowed - amount;
        return _transfer(from, to, amount);
    }

    function _transfer(address from, address to, uint256 amount) private returns (bool) {
        if (balanceOf[from] < amount) return false;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

    contract FreelanceEscrowTest {
        Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
        address private constant CLIENT = address(0xC1E17);
        address private constant FREELANCER = address(0xFEE1);
        address private constant ARBITRATOR = address(0xA8B);
        bytes32 private constant JOB = keccak256("job-1");
        uint256 private constant AMOUNT = 5_000e6;
        MockUSDC private usdc;
        FreelanceEscrow private escrow;

        function setUp() public {
            usdc = new MockUSDC();
            escrow = new FreelanceEscrow(usdc, ARBITRATOR);
            usdc.mint(CLIENT, 100_000e6);
            vm.prank(CLIENT);
            usdc.approve(address(escrow), type(uint256).max);
        }

        function testClientReleasesDeliveredWork() public {
            vm.prank(CLIENT);
            escrow.fundJob(JOB, FREELANCER, AMOUNT);
            vm.prank(FREELANCER);
            escrow.markDelivered(JOB);
            vm.prank(CLIENT);
            escrow.release(JOB);
            require(usdc.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
            (,,, FreelanceEscrow.Status status) = escrow.jobs(JOB);
            require(status == FreelanceEscrow.Status.Released, "wrong status");
        }

        function testArbitratorCanSplitDispute() public {
            vm.prank(CLIENT);
            escrow.fundJob(JOB, FREELANCER, AMOUNT);
            vm.prank(FREELANCER);
            escrow.raiseDispute(JOB);
            vm.prank(ARBITRATOR);
            escrow.resolveDispute(JOB, 1_500e6);
            require(usdc.balanceOf(CLIENT) == 96_500e6, "client award wrong");
            require(usdc.balanceOf(FREELANCER) == 3_500e6, "freelancer award wrong");
        }

        function testOnlyClientCanRelease() public {
            vm.prank(CLIENT);
            escrow.fundJob(JOB, FREELANCER, AMOUNT);
            vm.prank(FREELANCER);
            escrow.markDelivered(JOB);
            vm.expectRevert(FreelanceEscrow.NotClient.selector);
            vm.prank(FREELANCER);
            escrow.release(JOB);
        }

        function testRejectsOutOfRangeEscrow() public {
            vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
            vm.prank(CLIENT);
            escrow.fundJob(JOB, FREELANCER, 1_999e6);
        }
    }

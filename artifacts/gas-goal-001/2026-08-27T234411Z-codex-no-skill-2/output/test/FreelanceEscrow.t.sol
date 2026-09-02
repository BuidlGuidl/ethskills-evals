// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";

contract MockUSDC is IERC20 {
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function decimals() external pure returns (uint8) { return 6; }

    function mint(address to, uint256 value) external { balanceOf[to] += value; }
    function approve(address spender, uint256 value) external returns (bool) { allowance[msg.sender][spender] = value; return true; }
    function transfer(address to, uint256 value) external returns (bool) { return _transfer(msg.sender, to, value); }
    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        require(allowance[from][msg.sender] >= value, "allowance");
        allowance[from][msg.sender] -= value;
        return _transfer(from, to, value);
    }
    function _transfer(address from, address to, uint256 value) private returns (bool) {
        require(balanceOf[from] >= value, "balance");
        balanceOf[from] -= value;
        balanceOf[to] += value;
        return true;
    }
}

contract ClientActor {
    function approve(MockUSDC token, address escrow, uint256 amount) external { token.approve(escrow, amount); }
    function fund(FreelanceEscrow escrow) external { escrow.fund(); }
    function release(FreelanceEscrow escrow) external { escrow.release(); }
    function dispute(FreelanceEscrow escrow) external { escrow.raiseDispute(); }
}

contract FreelancerActor { function dispute(FreelanceEscrow escrow) external { escrow.raiseDispute(); } }
contract ArbitratorActor { function resolve(FreelanceEscrow escrow, uint256 amount) external { escrow.resolveDispute(amount); } }

contract FreelanceEscrowTest {
    uint256 private constant AMOUNT = 10_000 * 1e6;
    MockUSDC private token;
    ClientActor private client;
    FreelancerActor private freelancer;
    ArbitratorActor private arbitrator;

    function setUp() public {
        token = new MockUSDC();
        client = new ClientActor();
        freelancer = new FreelancerActor();
        arbitrator = new ArbitratorActor();
        token.mint(address(client), AMOUNT);
    }

    function testClientCanFundAndRelease() public {
        FreelanceEscrow escrow = _newEscrow();
        client.approve(token, address(escrow), AMOUNT);
        client.fund(escrow);
        require(token.balanceOf(address(escrow)) == AMOUNT, "not funded");
        client.release(escrow);
        require(token.balanceOf(address(freelancer)) == AMOUNT, "not paid");
        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Released), "wrong status");
    }

    function testArbitratorCanSplitDispute() public {
        FreelanceEscrow escrow = _newEscrow();
        client.approve(token, address(escrow), AMOUNT);
        client.fund(escrow);
        freelancer.dispute(escrow);
        arbitrator.resolve(escrow, 6_000 * 1e6);
        require(token.balanceOf(address(freelancer)) == 6_000 * 1e6, "freelancer split");
        require(token.balanceOf(address(client)) == 4_000 * 1e6, "client split");
    }

    function testRejectsAmountsOutsideBounds() public {
        bool reverted;
        try new FreelanceEscrow(address(token), address(client), address(freelancer), address(arbitrator), 1_999 * 1e6) {} catch { reverted = true; }
        require(reverted, "accepted low amount");
    }

    function _newEscrow() private returns (FreelanceEscrow) {
        return new FreelanceEscrow(address(token), address(client), address(freelancer), address(arbitrator), AMOUNT);
    }
}

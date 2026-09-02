// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {FreelanceEscrow, IERC20} from "../src/FreelanceEscrow.sol";

contract MockUSDC is IERC20 {
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

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
        require(allowance[from][msg.sender] >= amount, "allowance");
        allowance[from][msg.sender] -= amount;
        return _transfer(from, to, amount);
    }

    function _transfer(address from, address to, uint256 amount) private returns (bool) {
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

    contract Actor {
        function approve(MockUSDC token, address spender, uint256 amount) external {
            token.approve(spender, amount);
        }

        function create(FreelanceEscrow escrow, address freelancer, address arbiter, uint256 amount)
            external
            returns (uint256)
        {
            return escrow.createJob(freelancer, arbiter, amount, keccak256("terms"));
        }

        function submit(FreelanceEscrow escrow, uint256 id) external {
            escrow.submitWork(id, keccak256("work"));
        }

        function release(FreelanceEscrow escrow, uint256 id) external {
            escrow.release(id);
        }

        function dispute(FreelanceEscrow escrow, uint256 id) external {
            escrow.raiseDispute(id, keccak256("reason"));
        }

        function resolve(FreelanceEscrow escrow, uint256 id, uint256 freelancerAmount) external {
            escrow.resolveDispute(id, freelancerAmount);
        }
    }

    contract FreelanceEscrowTest {
        MockUSDC token = new MockUSDC();
        FreelanceEscrow escrow = new FreelanceEscrow(address(token), 2_000e6, 50_000e6);
        Actor client = new Actor();
        Actor freelancer = new Actor();
        Actor arbiter = new Actor();

        function setUp() public {
            token.mint(address(client), 10_000e6);
            client.approve(token, address(escrow), type(uint256).max);
        }

        function testClientReleasesSubmittedWork() public {
            uint256 id = client.create(escrow, address(freelancer), address(arbiter), 10_000e6);
            freelancer.submit(escrow, id);
            client.release(escrow, id);
            require(token.balanceOf(address(freelancer)) == 10_000e6, "freelancer not paid");
            require(escrow.totalEscrowed() == 0, "liability remains");
        }

        function testArbiterCanSplitDispute() public {
            uint256 id = client.create(escrow, address(freelancer), address(arbiter), 10_000e6);
            freelancer.dispute(escrow, id);
            arbiter.resolve(escrow, id, 6_000e6);
            require(token.balanceOf(address(freelancer)) == 6_000e6, "bad freelancer split");
            require(token.balanceOf(address(client)) == 4_000e6, "bad client split");
        }

        function testCannotCreateOutsideDollarBand() public {
            (bool ok,) = address(client)
                .call(
                    abi.encodeCall(
                        Actor.create, (escrow, address(freelancer), address(arbiter), 1_999e6)
                    )
                );
            require(!ok, "under minimum accepted");
        }
    }

// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "../src/interfaces/IERC20.sol";
import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
import {EscrowFactory} from "../src/EscrowFactory.sol";

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
        if (balanceOf[msg.sender] < value) return false;
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        if (balanceOf[from] < value || allowance[from][msg.sender] < value) return false;
        allowance[from][msg.sender] -= value;
        balanceOf[from] -= value;
        balanceOf[to] += value;
        return true;
    }
}

    contract FreelanceEscrowTest {
        MockUSDC private usdc;
        EscrowFactory private factory;
        address private constant FREELANCER = address(0xBEEF);
        address private constant ARBITRATOR = address(0xA11CE);
        uint256 private constant AMOUNT = 2_000e6;

        function setUp() public {
            usdc = new MockUSDC();
            factory = new EscrowFactory(usdc);
            usdc.mint(address(this), AMOUNT);
        }

        function testFundEscrow() public {
            FreelanceEscrow escrow = _create();
            usdc.approve(address(escrow), AMOUNT);
            escrow.fund();
            require(
                uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Funded), "not funded"
            );
            require(usdc.balanceOf(address(escrow)) == AMOUNT, "wrong escrow balance");
        }

        function testRejectsAmountOutsideRange() public {
            (bool ok,) = address(factory)
                .call(
                    abi.encodeCall(
                        factory.createEscrow,
                        (FREELANCER, ARBITRATOR, AMOUNT - 1, block.timestamp + 1 days, bytes32(0))
                    )
                );
            require(!ok, "accepted below-minimum amount");
        }

        function _create() private returns (FreelanceEscrow) {
            return factory.createEscrow(
                FREELANCER, ARBITRATOR, AMOUNT, block.timestamp + 1 days, keccak256("job-1")
            );
        }
    }

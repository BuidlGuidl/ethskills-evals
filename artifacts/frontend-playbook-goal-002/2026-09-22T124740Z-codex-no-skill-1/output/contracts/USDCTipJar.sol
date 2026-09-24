// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract USDCTipJar is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_NAME_BYTES = 64;
    uint256 public constant MAX_MESSAGE_BYTES = 280;

    IERC20 public immutable usdc;
    address public beneficiary;
    uint256 public totalTips;
    uint256 public tipCount;

    event TipSent(
        uint256 indexed tipId,
        address indexed tipper,
        uint256 amount,
        string name,
        string message,
        uint256 timestamp
    );
    event BeneficiaryUpdated(address indexed previousBeneficiary, address indexed newBeneficiary);
    event Withdrawn(address indexed beneficiary, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error NameTooLong();
    error MessageTooLong();
    error NothingToWithdraw();

    constructor(address usdc_, address initialOwner, address initialBeneficiary) Ownable(initialOwner) {
        if (usdc_ == address(0) || initialOwner == address(0) || initialBeneficiary == address(0)) {
            revert ZeroAddress();
        }

        usdc = IERC20(usdc_);
        beneficiary = initialBeneficiary;
    }

    function tip(uint256 amount, string calldata name, string calldata message) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (bytes(name).length > MAX_NAME_BYTES) revert NameTooLong();
        if (bytes(message).length > MAX_MESSAGE_BYTES) revert MessageTooLong();

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        uint256 tipId = ++tipCount;
        totalTips += amount;

        emit TipSent(tipId, msg.sender, amount, name, message, block.timestamp);
    }

    function setBeneficiary(address newBeneficiary) external onlyOwner {
        if (newBeneficiary == address(0)) revert ZeroAddress();

        address previousBeneficiary = beneficiary;
        beneficiary = newBeneficiary;

        emit BeneficiaryUpdated(previousBeneficiary, newBeneficiary);
    }

    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        uint256 balance = usdc.balanceOf(address(this));
        uint256 amountToWithdraw = amount == 0 ? balance : amount;
        if (amountToWithdraw == 0) revert NothingToWithdraw();

        usdc.safeTransfer(beneficiary, amountToWithdraw);

        emit Withdrawn(beneficiary, amountToWithdraw);
    }
}

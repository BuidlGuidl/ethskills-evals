// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @title Batch dispatcher for relayer-initiated ERC-20 payouts.
/// @notice The relayer EOA is the owner. The contract holds payout inventory
///         for each token. Each on-chain call fans out to many recipients,
///         amortizing the 21k intrinsic cost and warming token storage slots
///         across the whole batch. A failed entry (e.g. USDC blocklist) is
///         isolated: it emits TransferFailed and the batch continues.
contract BatchRelayer {
    address public owner;
    address public pendingOwner;
    bool public paused;

    event OwnershipTransferStarted(address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event PauseToggled(bool paused_);
    event BatchExecuted(address indexed token, uint256 count, uint256 totalAmount, uint256 failedCount);
    event TransferFailed(uint256 indexed index, address indexed recipient, uint256 amount);
    event FundsWithdrawn(address indexed token, address indexed to, uint256 amount);

    error NotOwner();
    error NotPendingOwner();
    error ZeroAddress();
    error ContractPaused();
    error EmptyBatch();
    error LengthMismatch();
    error WithdrawFailed();
    error EthTransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function batchTransfer(address token, address[] calldata recipients, uint256[] calldata amounts)
        external
        onlyOwner
        whenNotPaused
    {
        uint256 count = recipients.length;
        if (count == 0) revert EmptyBatch();
        if (count != amounts.length) revert LengthMismatch();
        uint256 total;
        uint256 failed;
        unchecked {
            for (uint256 i = 0; i < count; ++i) {
                address recipient = recipients[i];
                uint256 amount = amounts[i];
                total += amount;
                try IERC20(token).transfer(recipient, amount) {} catch {
                    ++failed;
                    emit TransferFailed(i, recipient, amount);
                }
            }
        }
        emit BatchExecuted(token, count, total, failed);
    }

    function withdraw(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (!IERC20(token).transfer(to, amount)) revert WithdrawFailed();
        emit FundsWithdrawn(token, to, amount);
    }

    function withdrawETH(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert EthTransferFailed();
        emit FundsWithdrawn(address(0), to, amount);
    }

    function setPaused(bool status) external onlyOwner {
        paused = status;
        emit PauseToggled(status);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }

    receive() external payable {}
}

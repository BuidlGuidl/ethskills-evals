// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Holds prefunded ERC-20 balances and sends many payouts in one Base transaction.
/// @dev Deliberately supports standard and non-standard ERC-20s which return no value.
///      Do not use it with fee-on-transfer or rebasing tokens unless the product accepts that
///      recipients may receive less than `amounts[i]`.
contract ERC20BatchDisburser {
    error Unauthorized();
    error LengthMismatch();
    error EmptyBatch();
    error BatchTooLarge();
    error ReentrantCall();
    error InvalidToken();
    error TokenTransferFailed(uint256 index);
    error EthTransferFailed();

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event BatchDisbursed(address indexed token, uint256 payoutCount, uint256 totalAmount);
    event ERC20Recovered(address indexed token, address indexed to, uint256 amount);

    uint256 public constant MAX_PAYOUTS_PER_BATCH = 200;
    bytes4 private constant TRANSFER_SELECTOR = 0xa9059cbb;

    address public owner;
    uint256 private unlocked = 1;

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (unlocked != 1) revert ReentrantCall();
        unlocked = 2;
        _;
        unlocked = 1;
    }

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert Unauthorized();
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    /// @notice The relayer must first transfer `token` into this contract, then call this method.
    function disburse(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwner nonReentrant {
        if (token.code.length == 0) revert InvalidToken();
        uint256 length = recipients.length;
        if (length == 0) revert EmptyBatch();
        if (length != amounts.length) revert LengthMismatch();
        if (length > MAX_PAYOUTS_PER_BATCH) revert BatchTooLarge();

        uint256 totalAmount;
        for (uint256 i; i < length; ++i) {
            // A zero address is never a valid beneficiary for a token payment.
            if (recipients[i] == address(0)) revert TokenTransferFailed(i);
            totalAmount += amounts[i];
            _safeTransfer(token, recipients[i], amounts[i], i);
        }
        emit BatchDisbursed(token, length, totalAmount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert Unauthorized();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Emergency recovery. Put this owner behind the same multisig/policy as the relayer.
    function recoverERC20(address token, address to, uint256 amount) external onlyOwner nonReentrant {
        if (token.code.length == 0) revert InvalidToken();
        _safeTransfer(token, to, amount, type(uint256).max);
        emit ERC20Recovered(token, to, amount);
    }

    function recoverETH(address payable to, uint256 amount) external onlyOwner nonReentrant {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert EthTransferFailed();
    }

    function _safeTransfer(address token, address to, uint256 amount, uint256 index) private {
        (bool ok, bytes memory result) = token.call(
            abi.encodeWithSelector(TRANSFER_SELECTOR, to, amount)
        );
        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) {
            revert TokenTransferFailed(index);
        }
    }
}

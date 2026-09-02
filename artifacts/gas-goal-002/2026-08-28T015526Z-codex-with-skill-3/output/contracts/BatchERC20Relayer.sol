// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice A deliberately small, funded distributor for a single relayer operator.
/// @dev The contract holds the token balance.  This avoids one ERC-20 allowance
///      update per payment and lets one transaction pay many recipients.
interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract BatchERC20Relayer {
    error NotOwner();
    error ZeroAddress();
    error LengthMismatch();
    error EmptyBatch();
    error BatchTooLarge();
    error InvalidToken(address token);
    error TransferFailed(address token, address recipient, uint256 amount);

    uint256 public constant MAX_RECIPIENTS = 200;

    address public owner;
    address public pendingOwner;

    event OwnershipTransferStarted(address indexed owner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        owner = initialOwner;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @notice Transfer one ERC-20 balance held by this contract to each recipient.
    /// @dev Recipient-level events are provided by the ERC-20's Transfer logs;
    ///      emitting another event here would add avoidable execution and L1-data cost.
    function batchTransfer(
        IERC20 token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwner {
        uint256 length = recipients.length;
        if (length == 0) revert EmptyBatch();
        if (length != amounts.length) revert LengthMismatch();
        if (length > MAX_RECIPIENTS) revert BatchTooLarge();

        for (uint256 i; i < length; ++i) {
            _safeTransfer(token, recipients[i], amounts[i]);
        }
    }

    /// @notice Recover a token accidentally sent here, or move inventory during rotation.
    function rescueToken(IERC20 token, address recipient, uint256 amount) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        _safeTransfer(token, recipient, amount);
    }

    function transferOwnership(address nextOwner) external onlyOwner {
        if (nextOwner == address(0)) revert ZeroAddress();
        pendingOwner = nextOwner;
        emit OwnershipTransferStarted(owner, nextOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotOwner();
        address previousOwner = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(previousOwner, owner);
    }

    function _safeTransfer(IERC20 token, address recipient, uint256 amount) private {
        if (recipient == address(0)) revert ZeroAddress();
        if (address(token).code.length == 0) revert InvalidToken(address(token));
        (bool success, bytes memory returnedData) = address(token).call(
            abi.encodeCall(IERC20.transfer, (recipient, amount))
        );
        if (
            !success ||
            (returnedData.length != 0 && (returnedData.length != 32 || !abi.decode(returnedData, (bool))))
        ) {
            revert TransferFailed(address(token), recipient, amount);
        }
    }
}

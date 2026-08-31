// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Sends balances held by this contract to many recipients in one transaction.
/// @dev Only the immutable relayer/owner may execute or withdraw. Each payment is
///      encoded as 20 bytes of recipient followed by 32 bytes of uint256 amount.
contract ERC20BatchDistributor {
    error Unauthorized();
    error InvalidPaymentData();
    error TokenHasNoCode();
    error TokenTransferFailed();

    uint256 private constant PAYMENT_SIZE = 52;
    address public immutable owner;

    event BatchTransferred(address indexed token, uint256 paymentCount);
    event Withdrawn(address indexed token, address indexed recipient, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    /// @notice Transfer a prefunded ERC-20 balance to each packed payment recipient.
    /// @param token ERC-20 held by this contract.
    /// @param payments Concatenated {address (20 bytes), amount (32 bytes)} records.
    function batchTransfer(address token, bytes calldata payments) external onlyOwner {
        uint256 length = payments.length;
        if (length == 0 || length % PAYMENT_SIZE != 0) revert InvalidPaymentData();
        if (token.code.length == 0) revert TokenHasNoCode();

        for (uint256 offset; offset < length;) {
            address recipient;
            uint256 amount;
            assembly ("memory-safe") {
                recipient := shr(96, calldataload(add(payments.offset, offset)))
                amount := calldataload(add(add(payments.offset, offset), 20))
            }
            _safeTransfer(token, recipient, amount);
            unchecked {
                offset += PAYMENT_SIZE;
            }
        }

        emit BatchTransferred(token, length / PAYMENT_SIZE);
    }

    /// @notice Recover an ERC-20 balance. This is intentionally owner-only because
    ///         this contract is a relayer-controlled custody address.
    function withdraw(address token, address recipient, uint256 amount) external onlyOwner {
        if (token.code.length == 0) revert TokenHasNoCode();
        _safeTransfer(token, recipient, amount);
        emit Withdrawn(token, recipient, amount);
    }

    function _safeTransfer(address token, address recipient, uint256 amount) private {
        assembly ("memory-safe") {
            let pointer := mload(0x40)
            // transfer(address,uint256)
            mstore(pointer, 0xa9059cbb00000000000000000000000000000000000000000000000000000000)
            mstore(add(pointer, 4), recipient)
            mstore(add(pointer, 36), amount)

            let success := call(gas(), token, 0, pointer, 68, 0, 32)
            let returnSize := returndatasize()
            // Permit both standard `true` and legacy no-return ERC-20s.
            let returnedTrue := and(iszero(lt(returnSize, 32)), eq(mload(0), 1))
            if iszero(and(success, or(iszero(returnSize), returnedTrue))) {
                mstore(0, 0x045c4b02) // TokenTransferFailed()
                revert(28, 4)
            }
        }
    }
}

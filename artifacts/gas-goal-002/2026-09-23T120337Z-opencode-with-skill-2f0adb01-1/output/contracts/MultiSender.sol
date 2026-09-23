// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract MultiSender {
    address public immutable owner;
    uint256 public constant MAX_BATCH = 500;

    error NotOwner();
    error BatchTooLarge(uint256 size);
    error LengthMismatch();
    error PayoutFailed(uint256 index);

    event PayoutBatched(
        address indexed token, address indexed payer, uint256 count, uint256 failures
    );

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function payout(address token, address[] calldata recipients, uint256[] calldata amounts)
        external
        onlyOwner
    {
        uint256 n = recipients.length;
        if (n != amounts.length) revert LengthMismatch();
        if (n > MAX_BATCH) revert BatchTooLarge(n);
        for (uint256 i = 0; i < n; ++i) {
            if (!IERC20(token).transferFrom(owner, recipients[i], amounts[i])) {
                revert PayoutFailed(i);
            }
        }
        emit PayoutBatched(token, owner, n, 0);
    }

    function payoutPartial(address token, address[] calldata recipients, uint256[] calldata amounts)
        external
        onlyOwner
        returns (uint256[] memory failed)
    {
        uint256 n = recipients.length;
        if (n != amounts.length) revert LengthMismatch();
        if (n > MAX_BATCH) revert BatchTooLarge(n);
        failed = new uint256[]((n + 255) / 256);
        uint256 failures;
        for (uint256 i = 0; i < n; ++i) {
            bool ok;
            try IERC20(token).transferFrom(owner, recipients[i], amounts[i]) returns (
                bool success
            ) {
                ok = success;
            } catch {
                ok = false;
            }
            if (!ok) {
                failed[i >> 8] |= 1 << (i & 255);
                ++failures;
            }
        }
        emit PayoutBatched(token, owner, n, failures);
    }

    struct Payment {
        address token;
        address recipient;
        uint256 amount;
    }

    function payoutMixed(Payment[] calldata payments)
        external
        onlyOwner
        returns (uint256[] memory failed)
    {
        uint256 n = payments.length;
        if (n > MAX_BATCH) revert BatchTooLarge(n);
        if (n == 0) return new uint256[](0);
        failed = new uint256[]((n + 255) / 256);
        uint256 failures;
        for (uint256 i = 0; i < n; ++i) {
            Payment calldata p = payments[i];
            bool ok;
            try IERC20(p.token).transferFrom(owner, p.recipient, p.amount) returns (bool success) {
                ok = success;
            } catch {
                ok = false;
            }
            if (!ok) {
                failed[i >> 8] |= 1 << (i & 255);
                ++failures;
            }
        }
        emit PayoutBatched(payments[0].token, owner, n, failures);
    }
}

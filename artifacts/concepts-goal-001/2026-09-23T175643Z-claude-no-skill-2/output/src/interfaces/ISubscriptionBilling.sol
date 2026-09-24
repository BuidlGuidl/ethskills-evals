// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice The read surface an API backend needs to gate requests, split out so callers can
///         depend on it without pulling in the full implementation.
interface ISubscriptionBilling {
    /// @param subscribed  True if `user` is entitled to service right now.
    /// @param planId      Plan the user is on (meaningless when `subscribed` is false).
    /// @param expiresAt   Unix time at which the prepaid balance runs out at the current rate.
    /// @param balance     Credit remaining after deducting everything accrued so far.
    /// @param accrued     Amount used but not yet swept to the operator.
    struct Status {
        bool subscribed;
        uint32 planId;
        uint64 expiresAt;
        uint256 balance;
        uint256 accrued;
    }

    function isSubscribed(address user) external view returns (bool);
    function statusOf(address user) external view returns (Status memory);
    function expiresAt(address user) external view returns (uint64);
}

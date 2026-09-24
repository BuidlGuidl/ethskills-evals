// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Read surface that off-chain services (the API gateway) depend on.
/// @dev Kept separate from the implementation so a backend can import a tiny ABI.
interface ISubscriptionBilling {
    /// @notice Snapshot of an account's subscription, with lazy renewals already applied.
    /// @param active     True if `account` is entitled to service right now.
    /// @param plan       Plan id (0 when not subscribed).
    /// @param rate       USDC charged per period for this subscription (locked at sign-up).
    /// @param periodEnd  End of the currently paid period; the next charge happens here.
    /// @param expiresAt  Latest timestamp the subscription can still be active given `credit`.
    ///                   Between now and `expiresAt` it can only end early by explicit cancel.
    /// @param credit     Unallocated USDC left on the account (excludes the paid-for period).
    /// @param refundable USDC returned right now by `cancelAndWithdraw()`.
    struct Status {
        bool active;
        uint8 plan;
        uint128 rate;
        uint64 periodEnd;
        uint64 expiresAt;
        uint256 credit;
        uint256 refundable;
    }

    /// @notice The single call an API gateway needs per request (or per cache miss).
    function isSubscribed(address account) external view returns (bool);

    /// @notice Same check, plus the plan id, for tier-aware rate limiting.
    function entitlementOf(address account) external view returns (bool active, uint8 plan);

    /// @notice Full projected state; use `expiresAt` to decide how long to cache.
    function statusOf(address account) external view returns (Status memory);
}

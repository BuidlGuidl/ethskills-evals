// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Minimal read surface an API backend needs. Deliberately small so a
///         gateway can hold this interface and nothing else.
interface ISubscriptionBilling {
    /// @return True if `account` is entitled to service right now.
    function isSubscribed(address account) external view returns (bool);

    /// @return planId The plan `account` is entitled to right now, or 0 if none.
    function planOf(address account) external view returns (uint32 planId);

    /// @return Timestamp at which `account` loses service if nothing else happens.
    ///         Safe to cache a gateway decision until this instant.
    function entitledUntil(address account) external view returns (uint64);
}

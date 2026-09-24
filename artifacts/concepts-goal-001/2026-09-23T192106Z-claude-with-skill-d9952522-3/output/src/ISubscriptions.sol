// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice The read surface a gatekeeper needs. Your API backend calls `isSubscribed`;
///         another contract can import this interface and gate on it the same way.
interface ISubscriptions {
    /// @return True while `account` has an active plan with prepaid balance left.
    function isSubscribed(address account) external view returns (bool);

    /// @return The unix timestamp at which `account`'s prepaid balance runs out.
    ///         Zero when the account has no plan. Can move earlier if the account
    ///         withdraws, later if it tops up.
    function expiryOf(address account) external view returns (uint64);
}

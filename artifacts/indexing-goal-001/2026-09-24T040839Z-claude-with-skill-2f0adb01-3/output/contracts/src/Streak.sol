// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Streak — daily onchain check-ins for a community on Base
/// @notice One write: `checkIn(note)`. At most one check-in per member per UTC day.
/// @dev The contract is deliberately minimal. It stores only what it needs to enforce
///      the once-per-day rule; every read the product needs (global feed, per-member
///      streak and totals, monthly leaderboard) is derived offchain from `CheckedIn`
///      events by the subgraph in ../subgraph. Aggregates like leaderboards are never
///      maintained onchain: they cost storage gas on every write and can't be sorted
///      or paginated by a contract anyway.
contract Streak {
    /// @notice Maximum length of a note, in bytes (UTF-8, so <= 140 characters).
    uint256 public constant MAX_NOTE_BYTES = 140;

    /// @notice Number of the last UTC day a member checked in, plus one.
    /// @dev Plus-one encoding so that 0 unambiguously means "never checked in".
    ///      Day numbers are `block.timestamp / 1 days`, i.e. whole UTC days since
    ///      the Unix epoch, which is exactly the bucket the product means by "a day".
    mapping(address => uint256) public lastDayPlusOne;

    /// @notice Emitted on every successful check-in. This event is the product's API.
    /// @param member   Who checked in. Indexed: the profile screen filters on it.
    /// @param dayIndex UTC day number (`timestamp / 86400`). Indexed: streak math and
    ///                 "did anyone check in on day N" queries filter on it.
    /// @param note     Free-form public note, may be empty.
    event CheckedIn(address indexed member, uint32 indexed dayIndex, string note);

    error AlreadyCheckedInToday(uint32 dayIndex);
    error NoteTooLong(uint256 length);

    /// @notice Check in for the current UTC day, optionally with a short public note.
    function checkIn(string calldata note) external {
        if (bytes(note).length > MAX_NOTE_BYTES) {
            revert NoteTooLong(bytes(note).length);
        }

        uint32 today = currentDayIndex();
        if (lastDayPlusOne[msg.sender] == uint256(today) + 1) {
            revert AlreadyCheckedInToday(today);
        }
        lastDayPlusOne[msg.sender] = uint256(today) + 1;

        emit CheckedIn(msg.sender, today, note);
    }

    /// @notice The current UTC day number.
    function currentDayIndex() public view returns (uint32) {
        // Safe: uint32 days since the epoch runs out in the year 11,761,191.
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint32(block.timestamp / 1 days);
    }

    /// @notice Whether `member` still has a check-in available today.
    /// @dev Used by the frontend to enable/disable the check-in button. This is a
    ///      current-state read, so a plain `eth_call` is the right tool for it.
    function canCheckIn(address member) external view returns (bool) {
        return lastDayPlusOne[member] != uint256(currentDayIndex()) + 1;
    }
}

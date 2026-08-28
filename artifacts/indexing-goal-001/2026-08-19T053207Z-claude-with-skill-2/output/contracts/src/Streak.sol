// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Streak
/// @notice Daily onchain check-in book for a community. One check-in per member
///         per UTC day, with an optional short public note.
/// @dev The contract is deliberately event-first: the only state it keeps is the
///      minimum needed to enforce the one-per-day rule. Streaks, totals and
///      rankings are derived from `CheckedIn` events by the indexer (see
///      ../indexer), never stored or computed here.
contract Streak {
    /// @notice Length of a check-in day, in seconds. Days are UTC days.
    uint256 public constant SECONDS_PER_DAY = 1 days;

    /// @notice Maximum note length, in bytes (UTF-8).
    uint256 public constant MAX_NOTE_BYTES = 140;

    /// @notice UTC day index of a member's most recent check-in. Zero if never.
    mapping(address member => uint32 day) public lastCheckInDay;

    /// @notice Emitted on every check-in. This event is the complete public
    ///         record of the app: the feed, the streaks and the leaderboard are
    ///         all rebuilt from it, so it carries everything the read side needs.
    /// @param member The account that checked in.
    /// @param day UTC day index (unix timestamp / 86400) of the check-in.
    /// @param timestamp Block timestamp of the check-in, for display.
    /// @param note Optional public note, up to MAX_NOTE_BYTES bytes.
    event CheckedIn(address indexed member, uint32 indexed day, uint64 timestamp, string note);

    /// @notice Thrown when a member checks in twice on the same UTC day.
    error AlreadyCheckedInToday(uint32 day);

    /// @notice Thrown when a note exceeds MAX_NOTE_BYTES.
    error NoteTooLong(uint256 length);

    /// @notice Check in for today without a note.
    function checkIn() external {
        _checkIn("");
    }

    /// @notice Check in for today with a short public note.
    /// @param note Free-form text, up to MAX_NOTE_BYTES bytes.
    function checkIn(string calldata note) external {
        _checkIn(note);
    }

    /// @notice The current UTC day index, as used by `lastCheckInDay` and events.
    function currentDay() public view returns (uint32) {
        return uint32(block.timestamp / SECONDS_PER_DAY);
    }

    /// @notice Whether `member` has a check-in available right now.
    function canCheckIn(address member) external view returns (bool) {
        return lastCheckInDay[member] != currentDay();
    }

    function _checkIn(string memory note) internal {
        if (bytes(note).length > MAX_NOTE_BYTES) {
            revert NoteTooLong(bytes(note).length);
        }

        uint32 day = currentDay();
        if (lastCheckInDay[msg.sender] == day) {
            revert AlreadyCheckedInToday(day);
        }
        lastCheckInDay[msg.sender] = day;

        emit CheckedIn(msg.sender, day, uint64(block.timestamp), note);
    }
}

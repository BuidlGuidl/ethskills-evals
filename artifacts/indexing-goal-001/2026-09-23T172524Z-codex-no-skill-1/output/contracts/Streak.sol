// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title Streak
/// @notice A minimal daily onchain check-in contract for a community.
contract Streak {
    uint256 public constant MAX_NOTE_BYTES = 160;
    uint256 private constant SECONDS_PER_DAY = 1 days;

    struct MemberStats {
        uint64 totalCheckIns;
        uint64 streakAtLastCheckIn;
        uint64 lastCheckInDay;
    }

    mapping(address member => MemberStats stats) private memberStats;

    event CheckIn(
        address indexed member,
        uint64 indexed day,
        uint64 totalCheckIns,
        uint64 streakAtCheckIn,
        string note
    );

    error AlreadyCheckedInToday();
    error NoteTooLong(uint256 maxBytes);

    /// @notice Check in once for the current UTC day. The optional note is public event data.
    function checkIn(string calldata note) external {
        if (bytes(note).length > MAX_NOTE_BYTES) {
            revert NoteTooLong(MAX_NOTE_BYTES);
        }

        uint64 todayDay = uint64(block.timestamp / SECONDS_PER_DAY);
        MemberStats storage stats = memberStats[msg.sender];

        if (stats.totalCheckIns != 0 && stats.lastCheckInDay == todayDay) {
            revert AlreadyCheckedInToday();
        }

        uint64 nextStreak = stats.totalCheckIns != 0 && stats.lastCheckInDay + 1 == todayDay
            ? stats.streakAtLastCheckIn + 1
            : 1;
        uint64 nextTotal = stats.totalCheckIns + 1;

        stats.lastCheckInDay = todayDay;
        stats.streakAtLastCheckIn = nextStreak;
        stats.totalCheckIns = nextTotal;

        emit CheckIn(msg.sender, todayDay, nextTotal, nextStreak, note);
    }

    /// @notice Return a member's total check-ins, current streak, and last check-in day.
    /// @dev A streak remains current through the day after the last check-in.
    function getMember(address member)
        external
        view
        returns (uint64 totalCheckIns, uint64 currentStreak, uint64 lastCheckInDay)
    {
        MemberStats memory stats = memberStats[member];
        uint64 todayDay = uint64(block.timestamp / SECONDS_PER_DAY);
        uint64 activeStreak = stats.totalCheckIns != 0 && stats.lastCheckInDay + 1 >= todayDay
            ? stats.streakAtLastCheckIn
            : 0;

        return (stats.totalCheckIns, activeStreak, stats.lastCheckInDay);
    }
}

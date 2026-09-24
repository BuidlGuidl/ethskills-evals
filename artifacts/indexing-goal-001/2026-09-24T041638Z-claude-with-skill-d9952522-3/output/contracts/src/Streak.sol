// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title Streak
/// @notice Daily onchain check-in for a community. One write: `checkIn`.
/// @dev Event-first: `CheckedIn` carries everything the feed, profile and
///      leaderboard need, so the read side never has to reconstruct state by
///      replaying storage or calling an archive node.
contract Streak {
    /// @dev Days are UTC day indices: unix timestamp / 86400.
    uint256 private constant SECONDS_PER_DAY = 1 days;

    /// @notice Longest note accepted, in bytes.
    uint256 public constant MAX_NOTE_BYTES = 140;

    struct Member {
        uint32 lastDay; // UTC day index of the most recent check-in (0 = never)
        uint32 firstDay; // UTC day index of the first ever check-in
        uint32 streakAtLastDay; // consecutive days as of `lastDay`
        uint32 longestStreak; // best streak ever reached
        uint32 total; // all-time check-ins
    }

    mapping(address => Member) private _members;

    /// @notice All-time check-ins across everyone.
    uint64 public totalCheckIns;

    /// @notice Distinct addresses that have ever checked in.
    uint64 public totalMembers;

    /// @param member     Who checked in.
    /// @param day        UTC day index of the check-in.
    /// @param streak     Their consecutive-day streak including this check-in.
    /// @param total      Their all-time check-in count including this one.
    /// @param isNewMember True on the member's very first check-in.
    /// @param note       Their public note (may be empty).
    event CheckedIn(
        address indexed member,
        uint32 indexed day,
        uint32 streak,
        uint32 total,
        bool isNewMember,
        string note
    );

    error AlreadyCheckedInToday(uint32 day);
    error NoteTooLong(uint256 length, uint256 max);

    /// @notice Check in for the current UTC day, with an optional public note.
    /// @param note Free-form note, up to `MAX_NOTE_BYTES` bytes. Pass "" for none.
    function checkIn(string calldata note) external {
        if (bytes(note).length > MAX_NOTE_BYTES) {
            revert NoteTooLong(bytes(note).length, MAX_NOTE_BYTES);
        }

        uint32 today = currentDay();
        Member storage m = _members[msg.sender];

        if (m.lastDay == today && m.total != 0) revert AlreadyCheckedInToday(today);

        bool isNewMember = m.total == 0;
        // Consecutive only if the previous check-in was literally yesterday.
        uint32 streak = (!isNewMember && m.lastDay + 1 == today) ? m.streakAtLastDay + 1 : 1;

        m.lastDay = today;
        m.streakAtLastDay = streak;
        m.total += 1;
        if (streak > m.longestStreak) m.longestStreak = streak;
        if (isNewMember) {
            m.firstDay = today;
            totalMembers += 1;
        }

        totalCheckIns += 1;

        emit CheckedIn(msg.sender, today, streak, m.total, isNewMember, note);
    }

    /// @notice The current UTC day index.
    function currentDay() public view returns (uint32) {
        return uint32(block.timestamp / SECONDS_PER_DAY);
    }

    /// @notice Whether `who` has already checked in today.
    function hasCheckedInToday(address who) external view returns (bool) {
        Member storage m = _members[who];
        return m.total != 0 && m.lastDay == currentDay();
    }

    /// @notice Live profile numbers for the profile screen.
    /// @dev `currentStreak` decays with wall-clock time, so it is computed here
    ///      rather than read from storage: a streak whose last check-in is older
    ///      than yesterday is already broken even though nothing was written.
    ///      This is an "as-of-now" read — call it directly (batch profiles with
    ///      Multicall3), don't index it.
    function profileOf(address who)
        external
        view
        returns (
            uint32 currentStreak,
            uint32 longestStreak,
            uint32 total,
            uint32 firstDay,
            uint32 lastDay,
            bool checkedInToday
        )
    {
        Member storage m = _members[who];
        uint32 today = currentDay();
        bool alive = m.total != 0 && (m.lastDay == today || m.lastDay + 1 == today);
        return (
            alive ? m.streakAtLastDay : 0,
            m.longestStreak,
            m.total,
            m.firstDay,
            m.lastDay,
            m.total != 0 && m.lastDay == today
        );
    }
}

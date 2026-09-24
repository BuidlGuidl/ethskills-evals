// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Streak
/// @notice Daily onchain check-in book for a community. One check-in per member
///         per UTC day, with an optional short public note.
/// @dev The contract stores only what it needs to enforce the once-a-day rule and
///      to answer a profile query directly from chain state. Everything the app
///      renders (the global feed, monthly leaderboards) is derived offchain from
///      the `CheckedIn` event log, which is the canonical history.
contract Streak {
    /// @notice Length of a day in seconds. Days are UTC-aligned: day N covers
    ///         [N * 1 days, (N + 1) * 1 days).
    uint256 public constant DAY = 1 days;

    /// @notice Maximum note length in bytes. Notes are emitted, never stored.
    uint256 public constant MAX_NOTE_BYTES = 140;

    struct Member {
        /// @dev UTC day index of the member's most recent check-in. 0 = never.
        uint32 lastDay;
        /// @dev UTC day index of the member's first ever check-in. 0 = never.
        uint32 firstDay;
        /// @dev Streak as of `lastDay`. Stale once `lastDay` is more than a day
        ///      old — read it through `currentStreakOf` instead of raw.
        uint32 streak;
        /// @dev Longest streak the member has ever reached.
        uint32 longestStreak;
        /// @dev All-time number of check-ins.
        uint32 total;
    }

    mapping(address => Member) private _members;

    /// @notice All-time number of check-ins across every member.
    uint256 public totalCheckIns;

    /// @notice Number of addresses that have ever checked in.
    uint256 public totalMembers;

    /// @notice Emitted once per successful check-in. This log is the complete,
    ///         replayable history of the app.
    /// @param member The member who checked in.
    /// @param day UTC day index (unix timestamp / 86400) the check-in belongs to.
    /// @param timestamp Block timestamp of the check-in.
    /// @param streak The member's streak length including this check-in.
    /// @param total The member's all-time check-in count including this one.
    /// @param note Optional public note, at most `MAX_NOTE_BYTES` bytes.
    event CheckedIn(
        address indexed member, uint32 indexed day, uint64 timestamp, uint32 streak, uint32 total, string note
    );

    /// @notice Thrown when a member checks in twice in the same UTC day.
    error AlreadyCheckedIn(address member, uint32 day);

    /// @notice Thrown when a note exceeds `MAX_NOTE_BYTES`.
    error NoteTooLong(uint256 length);

    /// @notice Check in for today, with an optional note.
    /// @param note Public note, may be empty. At most `MAX_NOTE_BYTES` bytes.
    /// @return day The UTC day index the check-in was recorded for.
    /// @return streak The member's streak length including this check-in.
    function checkIn(string calldata note) external returns (uint32 day, uint32 streak) {
        if (bytes(note).length > MAX_NOTE_BYTES) {
            revert NoteTooLong(bytes(note).length);
        }

        day = currentDay();
        Member storage m = _members[msg.sender];

        if (m.total == 0) {
            // First ever check-in for this address.
            m.firstDay = day;
            streak = 1;
            unchecked {
                ++totalMembers;
            }
        } else {
            if (m.lastDay == day) revert AlreadyCheckedIn(msg.sender, day);
            // Consecutive if the previous check-in was yesterday, else restart.
            streak = m.lastDay + 1 == day ? m.streak + 1 : 1;
        }

        m.lastDay = day;
        m.streak = streak;
        if (streak > m.longestStreak) m.longestStreak = streak;

        unchecked {
            // A single address cannot realistically overflow uint32 check-ins
            // (one per day), and totalCheckIns cannot overflow uint256.
            m.total += 1;
            ++totalCheckIns;
        }

        emit CheckedIn(msg.sender, day, uint64(block.timestamp), streak, m.total, note);
    }

    /// @notice The current UTC day index.
    function currentDay() public view returns (uint32) {
        return uint32(block.timestamp / DAY);
    }

    /// @notice Whether `member` has already checked in during the current UTC day.
    function hasCheckedInToday(address member) external view returns (bool) {
        Member storage m = _members[member];
        return m.total != 0 && m.lastDay == currentDay();
    }

    /// @notice A member's live streak, accounting for missed days.
    /// @dev A streak survives until the end of the day after the last check-in:
    ///      checking in yesterday means the streak is still alive today, but it
    ///      is broken once a full day has been skipped.
    function currentStreakOf(address member) public view returns (uint32) {
        Member storage m = _members[member];
        if (m.total == 0) return 0;
        uint32 today = currentDay();
        if (m.lastDay == today || m.lastDay + 1 == today) return m.streak;
        return 0;
    }

    /// @notice Full profile state for `member`.
    /// @return currentStreak Live streak (0 if broken).
    /// @return longestStreak Best streak ever reached.
    /// @return total All-time check-ins.
    /// @return firstDay UTC day index of the first check-in (0 if never).
    /// @return lastDay UTC day index of the most recent check-in (0 if never).
    function profileOf(address member)
        external
        view
        returns (uint32 currentStreak, uint32 longestStreak, uint32 total, uint32 firstDay, uint32 lastDay)
    {
        Member storage m = _members[member];
        return (currentStreakOf(member), m.longestStreak, m.total, m.firstDay, m.lastDay);
    }

    /// @notice Raw stored member record. `streak` here is as of `lastDay` and may
    ///         be stale; prefer `profileOf` / `currentStreakOf`.
    function memberOf(address member) external view returns (Member memory) {
        return _members[member];
    }
}

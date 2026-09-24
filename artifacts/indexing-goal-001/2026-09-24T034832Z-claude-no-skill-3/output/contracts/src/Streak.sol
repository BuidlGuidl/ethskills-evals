// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Streak
/// @notice Daily onchain check-in board. A member may check in once per UTC day,
///         optionally attaching a short public note.
/// @dev The contract is the source of truth for the whole history: every check-in
///      emits a `CheckedIn` log carrying the note and the member's streak/total as
///      of that check-in, so an indexer can rebuild the feed, profiles and monthly
///      leaderboards from the deployment block onward without any extra calls.
contract Streak {
    /// @notice Length of a "day" in seconds. Days are UTC-aligned (day 0 = 1970-01-01).
    uint256 public constant DAY = 1 days;

    /// @notice Maximum note length, in bytes.
    uint256 public constant MAX_NOTE_BYTES = 140;

    struct Member {
        uint32 lastDay; // UTC day index of the member's most recent check-in
        uint32 streak; // consecutive days, as of `lastDay`
        uint32 total; // all-time check-ins
        uint32 firstDay; // UTC day index of the member's first check-in
    }

    mapping(address => Member) private _members;

    /// @notice All-time number of check-ins across every member.
    uint256 public totalCheckIns;

    /// @notice Number of distinct addresses that have ever checked in.
    uint256 public totalMembers;

    /// @notice Emitted once per check-in.
    /// @param member  Who checked in.
    /// @param day     UTC day index (unix seconds / 86400) the check-in belongs to.
    /// @param streak  The member's consecutive-day streak including this check-in.
    /// @param total   The member's all-time check-in count including this one.
    /// @param note    Free-form public note; may be empty.
    event CheckedIn(address indexed member, uint32 indexed day, uint32 streak, uint32 total, string note);

    error AlreadyCheckedInToday(uint32 day);
    error NoteTooLong(uint256 length, uint256 max);

    /// @notice Check in for the current UTC day with no note.
    function checkIn() external returns (uint32 streak) {
        return _checkIn("");
    }

    /// @notice Check in for the current UTC day with a short public note.
    /// @param note Up to `MAX_NOTE_BYTES` bytes of UTF-8.
    function checkIn(string calldata note) external returns (uint32 streak) {
        if (bytes(note).length > MAX_NOTE_BYTES) {
            revert NoteTooLong(bytes(note).length, MAX_NOTE_BYTES);
        }
        return _checkIn(note);
    }

    function _checkIn(string memory note) private returns (uint32 streak) {
        uint32 today = currentDay();
        Member storage m = _members[msg.sender];

        if (m.total == 0) {
            m.firstDay = today;
            totalMembers += 1;
            streak = 1;
        } else {
            if (m.lastDay == today) revert AlreadyCheckedInToday(today);
            // `lastDay` is strictly in the past here, so this is safe.
            streak = m.lastDay + 1 == today ? m.streak + 1 : 1;
        }

        m.lastDay = today;
        m.streak = streak;
        m.total += 1;
        totalCheckIns += 1;

        emit CheckedIn(msg.sender, today, streak, m.total, note);
    }

    /// @notice The current UTC day index.
    function currentDay() public view returns (uint32) {
        // casting to 'uint32' is safe: uint32 day indices last until the year 11,759,290.
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint32(block.timestamp / DAY);
    }

    /// @notice Whether `member` can still check in today.
    function canCheckIn(address member) external view returns (bool) {
        Member storage m = _members[member];
        return m.total == 0 || m.lastDay != currentDay();
    }

    /// @notice Raw stored record for `member`.
    function memberOf(address member) external view returns (Member memory) {
        return _members[member];
    }

    /// @notice `member`'s live streak: the stored streak if it is still alive
    ///         (they checked in today or yesterday), otherwise 0.
    function streakOf(address member) public view returns (uint32) {
        Member storage m = _members[member];
        if (m.total == 0) return 0;
        uint32 today = currentDay();
        if (m.lastDay == today || m.lastDay + 1 == today) return m.streak;
        return 0;
    }

    /// @notice `member`'s all-time check-in count.
    function totalOf(address member) external view returns (uint32) {
        return _members[member].total;
    }

    /// @notice Convenience read for a profile screen.
    /// @return streak    Live streak (0 if broken).
    /// @return best      Streak as of the member's last check-in.
    /// @return total     All-time check-ins.
    /// @return lastDay   UTC day index of the last check-in (0 if never).
    /// @return firstDay  UTC day index of the first check-in (0 if never).
    function profileOf(address member)
        external
        view
        returns (uint32 streak, uint32 best, uint32 total, uint32 lastDay, uint32 firstDay)
    {
        Member storage m = _members[member];
        return (streakOf(member), m.streak, m.total, m.lastDay, m.firstDay);
    }
}

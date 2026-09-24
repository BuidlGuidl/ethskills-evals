// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Streak
/// @notice One check-in per member per UTC day, with an optional short public note.
/// @dev The contract is the source of truth for *whether* a check-in happened and for the
///      streak/total counters at that moment. Everything the app renders (feed, profiles,
///      leaderboard) is derived from the `CheckedIn` event log by the indexer.
contract Streak {
    /// @notice Length of a check-in window. Days are UTC days: `block.timestamp / 1 days`.
    uint256 public constant DAY = 1 days;

    /// @notice Maximum note length, in bytes (not codepoints).
    uint256 public constant MAX_NOTE_BYTES = 140;

    struct Member {
        /// @dev UTC day index of the most recent check-in. 0 means "never checked in".
        uint32 lastDay;
        /// @dev Consecutive days ending at `lastDay`. Stale once `lastDay` is in the past.
        uint32 streak;
        /// @dev Longest streak ever reached.
        uint32 longestStreak;
        /// @dev All-time number of check-ins.
        uint32 total;
        /// @dev UTC day index of the member's first ever check-in.
        uint32 firstDay;
    }

    mapping(address => Member) private _members;

    /// @notice All-time number of check-ins across every member.
    uint256 public totalCheckIns;

    /// @notice Number of distinct addresses that have ever checked in.
    uint256 public totalMembers;

    /// @notice UTC day index on which this contract was deployed.
    uint32 public immutable deployDay;

    /// @notice Emitted once per member per day. This log is the app's read model.
    /// @param member The address that checked in.
    /// @param day UTC day index (`block.timestamp / 1 days`) the check-in belongs to.
    /// @param streak Consecutive days including this one.
    /// @param total The member's all-time check-in count including this one.
    /// @param note Free-form public note, may be empty.
    event CheckedIn(address indexed member, uint32 indexed day, uint32 streak, uint32 total, string note);

    error AlreadyCheckedInToday(uint32 day);
    error NoteTooLong(uint256 length, uint256 max);

    constructor() {
        deployDay = today();
    }

    /// @notice Record today's check-in for `msg.sender`.
    /// @param note Optional public note, up to `MAX_NOTE_BYTES` bytes. Pass "" for none.
    function checkIn(string calldata note) external {
        if (bytes(note).length > MAX_NOTE_BYTES) {
            revert NoteTooLong(bytes(note).length, MAX_NOTE_BYTES);
        }

        uint32 day = today();
        Member storage m = _members[msg.sender];

        if (m.total == 0) {
            m.firstDay = day;
            unchecked {
                ++totalMembers;
            }
        } else if (m.lastDay == day) {
            revert AlreadyCheckedInToday(day);
        }

        // Consecutive only if the previous check-in was yesterday.
        uint32 streak = (m.total != 0 && m.lastDay + 1 == day) ? m.streak + 1 : 1;

        m.lastDay = day;
        m.streak = streak;
        if (streak > m.longestStreak) m.longestStreak = streak;
        unchecked {
            m.total += 1;
            ++totalCheckIns;
        }

        emit CheckedIn(msg.sender, day, streak, m.total, note);
    }

    /// @notice Current UTC day index.
    function today() public view returns (uint32) {
        // Casting to 'uint32' is safe because the day index does not exceed uint32 until the year 11,761,191.
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint32(block.timestamp / DAY);
    }

    /// @notice Full stored record for `member`.
    function memberOf(address member) external view returns (Member memory) {
        return _members[member];
    }

    /// @notice Streak as of *now*: a streak that was not extended yesterday or today is over.
    function currentStreak(address member) external view returns (uint32) {
        Member storage m = _members[member];
        if (m.total == 0) return 0;
        uint32 t = today();
        return (m.lastDay == t || m.lastDay + 1 == t) ? m.streak : 0;
    }

    /// @notice All-time check-ins for `member`.
    function totalOf(address member) external view returns (uint32) {
        return _members[member].total;
    }

    /// @notice Whether `member` may check in right now.
    function canCheckIn(address member) external view returns (bool) {
        Member storage m = _members[member];
        return m.total == 0 || m.lastDay != today();
    }

    /// @notice Seconds until `member`'s next check-in window opens (0 if open now).
    function secondsUntilNextCheckIn(address member) external view returns (uint256) {
        Member storage m = _members[member];
        if (m.total == 0 || m.lastDay != today()) return 0;
        return ((uint256(m.lastDay) + 1) * DAY) - block.timestamp;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Streak
/// @notice Daily onchain check-in book for a community. One check-in per member
///         per UTC day, optionally carrying a short public note.
/// @dev The only state-changing entrypoint is {checkIn}. Notes are never stored
///      in contract storage — they are emitted in the {CheckedIn} log and read
///      back by the indexer, which keeps a check-in cheap regardless of note
///      length. Every field the read side needs to rebuild the full history is
///      in that one event.
contract Streak {
    /// @notice Length of a check-in day, in seconds. Days are UTC days, i.e.
    ///         day N covers [N * 1 days, (N + 1) * 1 days).
    uint256 public constant DAY = 1 days;

    /// @notice Maximum note length, in bytes (UTF-8, so <= 140 code points).
    uint256 public constant MAX_NOTE_BYTES = 140;

    struct Member {
        /// @dev UTC day index of the member's most recent check-in, 0 if never.
        uint32 lastDay;
        /// @dev UTC day index of the member's first check-in, 0 if never.
        uint32 firstDay;
        /// @dev Consecutive days ending at `lastDay`. See {currentStreakOf} for
        ///      the value as of *today*, which is what a profile screen wants.
        uint32 streak;
        /// @dev Longest run of consecutive days the member has ever put together.
        uint32 longestStreak;
        /// @dev All-time number of check-ins.
        uint32 total;
    }

    /// @notice Per-member counters, updated on every check-in.
    mapping(address member => Member) public members;

    /// @notice All-time number of check-ins across everyone.
    uint256 public totalCheckIns;

    /// @notice Number of addresses that have checked in at least once.
    uint256 public totalMembers;

    /// @notice Emitted once per successful check-in. This is the complete
    ///         record: the feed, the streaks and the leaderboard are all
    ///         derived from the stream of these logs.
    /// @param member The address that checked in.
    /// @param day UTC day index (unix seconds / 86400) the check-in counts for.
    /// @param streak The member's streak *including* this check-in.
    /// @param total The member's all-time check-in count including this one.
    /// @param note The public note, possibly empty.
    event CheckedIn(
        address indexed member, uint32 indexed day, uint32 streak, uint32 total, string note
    );

    /// @notice The member has already checked in during `day`.
    error AlreadyCheckedIn(uint32 day);

    /// @notice The note is longer than {MAX_NOTE_BYTES}.
    error NoteTooLong(uint256 length);

    /// @notice Check in for the current UTC day.
    /// @param note Optional public note; pass "" for none.
    function checkIn(string calldata note) external {
        if (bytes(note).length > MAX_NOTE_BYTES) {
            revert NoteTooLong(bytes(note).length);
        }

        uint32 day = today();
        Member storage member = members[msg.sender];

        if (member.total == 0) {
            member.firstDay = day;
            unchecked {
                ++totalMembers;
            }
        } else if (member.lastDay == day) {
            revert AlreadyCheckedIn(day);
        }

        // A streak continues only if the previous check-in was literally
        // yesterday; anything older (or a first-ever check-in) starts a new one.
        uint32 streak = member.lastDay == day - 1 ? member.streak + 1 : 1;

        member.lastDay = day;
        member.streak = streak;
        if (streak > member.longestStreak) {
            member.longestStreak = streak;
        }
        unchecked {
            member.total += 1;
            ++totalCheckIns;
        }

        emit CheckedIn(msg.sender, day, streak, member.total, note);
    }

    /// @notice The current UTC day index.
    function today() public view returns (uint32) {
        // Safe until the year 11,761,191: uint32 holds ~4.29e9 days.
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint32(block.timestamp / DAY);
    }

    /// @notice Whether `member` has already checked in today.
    function hasCheckedInToday(address member) external view returns (bool) {
        Member storage m = members[member];
        return m.total != 0 && m.lastDay == today();
    }

    /// @notice The member's streak as of today: the stored streak is only still
    ///         alive if their last check-in was today or yesterday, otherwise
    ///         the streak has lapsed and the answer is 0.
    /// @dev The indexer applies exactly this rule when serving a profile, so the
    ///      two sources of truth agree.
    function currentStreakOf(address member) external view returns (uint32) {
        Member storage m = members[member];
        if (m.total == 0) return 0;
        uint32 day = today();
        return (m.lastDay == day || m.lastDay == day - 1) ? m.streak : 0;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title Streak
/// @notice Daily onchain check-ins for a community. One check-in per member per
///         UTC day, with an optional short public note.
/// @dev    The contract is deliberately event-first: `CheckedIn` carries every
///         field the read side needs (who, when, the note, the streak and the
///         running total at that moment), so an indexer can rebuild the entire
///         history of the feed, the profiles and the leaderboard from logs alone
///         without a single archive-node `eth_call`.
///
///         Aggregation and ranking (the monthly leaderboard, the global feed
///         ordering, pagination) are intentionally NOT onchain. They live in the
///         indexer, where they are cheap. The only counters kept in storage are
///         the ones needed to enforce the once-a-day rule and to serve a single
///         member's current state as a plain contract call.
contract Streak {
    /// @dev Packs into a single storage slot (4 x uint32 = 128 bits).
    struct Member {
        /// @notice UTC day index (unix timestamp / 1 days) of the last check-in. 0 = never.
        uint32 lastCheckInDay;
        /// @notice Consecutive days as of `lastCheckInDay`. See `currentStreak()` for the live value.
        uint32 streakAtLastCheckIn;
        /// @notice Longest streak the member has ever reached.
        uint32 longestStreak;
        /// @notice All-time number of check-ins.
        uint32 totalCheckIns;
    }

    /// @notice Maximum length of a note, in bytes.
    uint256 public constant MAX_NOTE_BYTES = 140;

    /// @notice Per-member counters. Read directly (or batched via Multicall3) for
    ///         "as of now" values; use the indexer for history and ranking.
    mapping(address member => Member) public members;

    /// @notice Number of distinct addresses that have ever checked in.
    uint32 public totalMembers;

    /// @notice Total check-ins across everyone, all time.
    uint64 public totalCheckIns;

    /// @notice Emitted on every check-in. This is the read side's source of truth.
    /// @param member    Who checked in.
    /// @param day       UTC day index (unix timestamp / 1 days) of the check-in.
    /// @param month     UTC month key as `year * 100 + month` (e.g. 202608), so the
    ///                  leaderboard can bucket by month without recomputing dates.
    /// @param timestamp Block timestamp of the check-in.
    /// @param streak    Consecutive-day streak including this check-in.
    /// @param total     The member's all-time total including this check-in.
    /// @param note      Optional public note (may be empty). Not indexed: it is
    ///                  content to display, not something to filter on.
    event CheckedIn(
        address indexed member,
        uint32 indexed day,
        uint32 indexed month,
        uint64 timestamp,
        uint32 streak,
        uint32 total,
        string note
    );

    /// @notice Emitted the first time an address ever checks in.
    event MemberJoined(address indexed member, uint64 timestamp);

    error AlreadyCheckedInToday(uint32 day);
    error NoteTooLong(uint256 length, uint256 max);

    /// @notice Check in for today, with an optional note.
    /// @param note Public note, up to `MAX_NOTE_BYTES` bytes. Pass "" for none.
    function checkIn(string calldata note) external {
        if (bytes(note).length > MAX_NOTE_BYTES) {
            revert NoteTooLong(bytes(note).length, MAX_NOTE_BYTES);
        }

        uint32 today = uint32(block.timestamp / 1 days);
        Member memory m = members[msg.sender];

        if (m.lastCheckInDay == today) revert AlreadyCheckedInToday(today);

        if (m.totalCheckIns == 0) {
            unchecked {
                totalMembers += 1;
            }
            emit MemberJoined(msg.sender, uint64(block.timestamp));
        }

        uint32 streak = (m.lastCheckInDay == today - 1) ? m.streakAtLastCheckIn + 1 : 1;

        m.lastCheckInDay = today;
        m.streakAtLastCheckIn = streak;
        if (streak > m.longestStreak) m.longestStreak = streak;
        unchecked {
            m.totalCheckIns += 1;
            totalCheckIns += 1;
        }
        members[msg.sender] = m;

        emit CheckedIn(
            msg.sender, today, _monthKey(block.timestamp), uint64(block.timestamp), streak, m.totalCheckIns, note
        );
    }

    /// @notice The member's live streak: the stored streak decays to 0 once a full
    ///         day has been missed. The read side must apply the same rule.
    function currentStreak(address member) public view returns (uint32) {
        Member memory m = members[member];
        uint32 today = uint32(block.timestamp / 1 days);
        if (m.lastCheckInDay == today || m.lastCheckInDay == today - 1) {
            return m.streakAtLastCheckIn;
        }
        return 0;
    }

    /// @notice Whether the member can still check in today.
    function canCheckIn(address member) external view returns (bool) {
        return members[member].lastCheckInDay != uint32(block.timestamp / 1 days);
    }

    /// @notice Everything the profile screen needs "as of now", in one call.
    /// @dev    Batch this across many members with Multicall3
    ///         (0xcA11bde05977b3631167028862bE2a173976CA11) instead of indexing it.
    function profileOf(address member)
        external
        view
        returns (uint32 streak, uint32 longestStreak, uint32 total, uint32 lastCheckInDay, bool checkedInToday)
    {
        Member memory m = members[member];
        uint32 today = uint32(block.timestamp / 1 days);
        return (currentStreak(member), m.longestStreak, m.totalCheckIns, m.lastCheckInDay, m.lastCheckInDay == today);
    }

    /// @notice The current UTC month key, in the same `YYYYMM` form as the event.
    function currentMonth() external view returns (uint32) {
        return _monthKey(block.timestamp);
    }

    /// @dev Converts a unix timestamp to `year * 100 + month` (UTC).
    ///      Civil-from-days, after Howard Hinnant's date algorithms.
    function _monthKey(uint256 timestamp) internal pure returns (uint32) {
        unchecked {
            uint256 z = timestamp / 1 days + 719468;
            uint256 era = z / 146097;
            uint256 doe = z - era * 146097;
            uint256 yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
            uint256 doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
            uint256 mp = (5 * doy + 2) / 153;
            uint256 m = mp < 10 ? mp + 3 : mp - 9;
            uint256 y = yoe + era * 400 + (m <= 2 ? 1 : 0);
            return uint32(y * 100 + m);
        }
    }
}

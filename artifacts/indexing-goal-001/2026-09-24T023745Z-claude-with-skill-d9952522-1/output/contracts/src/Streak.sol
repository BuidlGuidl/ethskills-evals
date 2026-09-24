// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Streak — daily onchain check-ins for a community.
/// @notice One check-in per member per day, with an optional short public note.
///         The only write path is {checkIn}.
/// @dev Every state change emits {CheckedIn} carrying the complete post-state for
///      that member (day, streak, total). The read side (feed, profiles,
///      leaderboard) is built by an indexer replaying these events from the
///      deployment block, so the event — not storage — is the public API.
contract Streak {
    /// @notice Maximum length of a note, in bytes (UTF-8, so <= 140 codepoints).
    uint256 public constant MAX_NOTE_BYTES = 140;

    /// @notice Seconds added to unix time before bucketing into days.
    /// @dev Lets a community align the daily boundary with its own local midnight
    ///      instead of 00:00 UTC. Fixed at deploy so day math is stable forever.
    int256 public immutable dayOffsetSeconds;

    /// @notice Block timestamp of the first check-in ever recorded, 0 if none yet.
    /// @dev Only used by offchain tooling as a sanity check against the backfill.
    uint64 public firstCheckInAt;

    /// @notice Total check-ins ever recorded, across all members.
    uint64 public totalCheckIns;

    /// @notice Number of addresses that have checked in at least once.
    uint64 public totalMembers;

    struct Member {
        /// @dev Day index of the most recent check-in; 0 means never checked in.
        ///      Day 0 is unreachable in practice (it is 1970), so 0 is a safe sentinel.
        uint32 lastDay;
        /// @dev Consecutive days ending at `lastDay`.
        uint32 currentStreak;
        /// @dev Longest streak this member has ever reached.
        uint32 longestStreak;
        /// @dev All-time check-ins by this member.
        uint32 total;
    }

    /// @notice Per-member counters. Exposed for "as of now" reads (e.g. to gate the
    ///         check-in button); historical views come from the indexer.
    mapping(address => Member) public members;

    /// @notice Emitted on every successful check-in.
    /// @param member The member checking in.
    /// @param day Day index (offset unix time / 86400) the check-in belongs to.
    /// @param timestamp Block timestamp, so the feed can show an exact time.
    /// @param currentStreak The member's streak *after* this check-in.
    /// @param totalCheckIns The member's all-time total *after* this check-in.
    /// @param note The public note; may be empty.
    /// @dev `member` and `day` are indexed so an indexer can filter per member and
    ///      per day window; `note` is left unindexed so its value stays readable
    ///      (indexed dynamic types are hashed and the text would be lost).
    event CheckedIn(
        address indexed member,
        uint32 indexed day,
        uint64 timestamp,
        uint32 currentStreak,
        uint32 totalCheckIns,
        string note
    );

    /// @notice Emitted the first time an address ever checks in.
    /// @dev Lets the indexer count members and date "joined" without a storage read.
    event MemberJoined(address indexed member, uint32 indexed day, uint64 timestamp);

    /// @notice Emitted when a member sets a new personal best streak.
    event StreakRecord(address indexed member, uint32 indexed day, uint32 length);

    error AlreadyCheckedInToday(uint32 day);
    error NoteTooLong(uint256 length);

    /// @param _dayOffsetSeconds Seconds added to unix time before day bucketing.
    ///        0 for UTC midnight; -18000 shifts the boundary to 00:00 EST.
    constructor(int256 _dayOffsetSeconds) {
        dayOffsetSeconds = _dayOffsetSeconds;
    }

    /// @notice Record today's check-in for `msg.sender`.
    /// @param note Optional public note, up to {MAX_NOTE_BYTES} bytes. Pass "" for none.
    /// @return day The day index this check-in was recorded under.
    /// @return streak The caller's streak after this check-in.
    function checkIn(string calldata note) external returns (uint32 day, uint32 streak) {
        if (bytes(note).length > MAX_NOTE_BYTES) revert NoteTooLong(bytes(note).length);

        day = currentDay();
        Member storage m = members[msg.sender];

        uint32 last = m.lastDay;
        if (last == day) revert AlreadyCheckedInToday(day);

        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 nowTs = uint64(block.timestamp);

        if (last == 0) {
            streak = 1;
            unchecked {
                totalMembers += 1;
            }
            if (firstCheckInAt == 0) firstCheckInAt = nowTs;
            emit MemberJoined(msg.sender, day, nowTs);
        } else if (last + 1 == day) {
            // Checked in yesterday: the streak continues.
            streak = m.currentStreak + 1;
        } else {
            // Missed at least one whole day: the streak restarts.
            streak = 1;
        }

        uint32 newTotal = m.total + 1;

        m.lastDay = day;
        m.currentStreak = streak;
        m.total = newTotal;

        if (streak > m.longestStreak) {
            m.longestStreak = streak;
            emit StreakRecord(msg.sender, day, streak);
        }

        unchecked {
            totalCheckIns += 1;
        }

        emit CheckedIn(msg.sender, day, nowTs, streak, newTotal, note);
    }

    /// @notice The day index the current block falls in.
    function currentDay() public view returns (uint32) {
        return dayOf(block.timestamp);
    }

    /// @notice The day index a given unix timestamp falls in, under this contract's offset.
    function dayOf(uint256 timestamp) public view returns (uint32) {
        // `timestamp` is a block timestamp, far below int256 max.
        // forge-lint: disable-next-line(unsafe-typecast)
        int256 shifted = int256(timestamp) + dayOffsetSeconds;
        if (shifted < 0) return 0;
        // Day index fits in uint32 until the year ~11.7 million.
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint32(uint256(shifted) / 1 days);
    }

    /// @notice Whether `member` can check in right now.
    /// @dev Cheap "as of now" read for the UI; no indexer involved.
    function canCheckIn(address member) external view returns (bool) {
        return members[member].lastDay != currentDay();
    }

    /// @notice A member's live streak, counting a missed day as broken.
    /// @dev `members[a].currentStreak` is the streak as of that member's last
    ///      check-in and goes stale once a day is missed; this applies the decay so
    ///      a profile page can show the true current value without an indexer.
    function liveStreak(address member) external view returns (uint32) {
        Member memory m = members[member];
        if (m.lastDay == 0) return 0;
        uint32 today = currentDay();
        if (m.lastDay == today || m.lastDay + 1 == today) return m.currentStreak;
        return 0;
    }
}

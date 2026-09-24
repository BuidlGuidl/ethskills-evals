// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title Streak
/// @notice Daily onchain check-in book for a community. One check-in per member
///         per UTC day, optionally carrying a short public note.
/// @dev The contract is deliberately event-first: `CheckedIn` carries everything
///      the feed, the profile and the leaderboard need, so the whole product can
///      be rebuilt from logs alone by an indexer (see ../subgraph). Onchain
///      storage only holds what the *write* path needs to enforce its rules
///      (one per day, streak continuity) — no feeds, no rankings, no arrays.
contract Streak {
    /// @notice Length of a check-in day, in seconds. Days are UTC-aligned.
    uint256 public constant DAY = 1 days;

    /// @notice Maximum note length in bytes. Notes are public and cost calldata,
    ///         so they are capped rather than unbounded.
    uint256 public constant MAX_NOTE_BYTES = 140;

    struct Member {
        /// Day index (unix day) of the member's most recent check-in. 0 = never.
        uint32 lastDay;
        /// Consecutive-day streak as of `lastDay`.
        uint32 streak;
        /// Best streak the member has ever reached.
        uint32 longestStreak;
        /// All-time number of check-ins.
        uint32 total;
    }

    /// @notice Per-member write-path state.
    mapping(address => Member) public members;

    /// @notice All-time check-ins across every member.
    uint256 public totalCheckIns;

    /// @notice Number of distinct addresses that have ever checked in.
    uint256 public totalMembers;

    /// @notice Emitted on every successful check-in. This is the app's API.
    /// @param member  Who checked in.
    /// @param day     UTC day index (`block.timestamp / 1 days`) of the check-in.
    /// @param streak  The member's consecutive-day streak including this check-in.
    /// @param total   The member's all-time check-in count including this one.
    /// @param note    Free-form public note, possibly empty.
    event CheckedIn(
        address indexed member,
        uint32 indexed day,
        uint32 streak,
        uint32 total,
        string note
    );

    /// @notice Emitted the first time an address ever checks in, so an indexer
    ///         can count the community without scanning every member.
    event MemberJoined(address indexed member, uint32 indexed day);

    error AlreadyCheckedInToday(uint32 day);
    error NoteTooLong(uint256 length, uint256 max);

    /// @notice Check in for the current UTC day with an optional public note.
    /// @param note Up to `MAX_NOTE_BYTES` bytes of free text. Pass "" for none.
    function checkIn(string calldata note) external {
        if (bytes(note).length > MAX_NOTE_BYTES) {
            revert NoteTooLong(bytes(note).length, MAX_NOTE_BYTES);
        }

        uint32 today = currentDay();
        Member storage m = members[msg.sender];

        if (m.lastDay == today) revert AlreadyCheckedInToday(today);

        bool isNewMember = m.total == 0;
        if (isNewMember) {
            unchecked {
                ++totalMembers;
            }
            emit MemberJoined(msg.sender, today);
        }

        // A streak continues only if the previous check-in was literally
        // yesterday; any longer gap restarts it at 1.
        uint32 newStreak = (m.lastDay + 1 == today) ? m.streak + 1 : 1;
        uint32 newTotal = m.total + 1;

        m.lastDay = today;
        m.streak = newStreak;
        m.total = newTotal;
        if (newStreak > m.longestStreak) m.longestStreak = newStreak;

        unchecked {
            ++totalCheckIns;
        }

        emit CheckedIn(msg.sender, today, newStreak, newTotal, note);
    }

    /// @notice The current UTC day index.
    function currentDay() public view returns (uint32) {
        return uint32(block.timestamp / DAY);
    }

    /// @notice Whether `member` still has a check-in available today.
    function canCheckIn(address member) external view returns (bool) {
        return members[member].lastDay != currentDay();
    }

    /// @notice The member's streak as of *now*, not as of their last check-in.
    /// @dev A stored streak goes stale the moment a day is missed. A streak is
    ///      still alive if the last check-in was today or yesterday; otherwise
    ///      it has already been broken and this returns 0. Read-side consumers
    ///      must apply the same rule — the subgraph mappings do.
    function currentStreak(address member) external view returns (uint32) {
        Member storage m = members[member];
        if (m.total == 0) return 0;
        uint32 today = currentDay();
        if (m.lastDay == today || m.lastDay + 1 == today) return m.streak;
        return 0;
    }

    /// @notice Full write-path state for a member in one call.
    function memberStats(address member)
        external
        view
        returns (uint32 lastDay, uint32 streak, uint32 longestStreak, uint32 total)
    {
        Member storage m = members[member];
        return (m.lastDay, m.streak, m.longestStreak, m.total);
    }
}

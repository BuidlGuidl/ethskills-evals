// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title Streak
/// @notice Daily onchain check-ins for a community. A member may check in once per
///         UTC day, optionally with a short public note.
/// @dev The note is only ever emitted in the `CheckedIn` event — it is never written
///      to storage. The full history (feed, streaks, leaderboards) is reconstructed
///      offchain by indexing `CheckedIn` from the deployment block onwards.
contract Streak {
    /// @notice Maximum length of a note, in bytes (not characters).
    uint256 public constant MAX_NOTE_BYTES = 140;

    uint256 private constant SECONDS_PER_DAY = 1 days;

    /// @dev Packs into a single storage slot (5 x uint32 = 160 bits).
    struct Member {
        /// @dev UTC day index of the member's first check-in.
        uint32 firstDay;
        /// @dev UTC day index of the member's most recent check-in.
        uint32 lastDay;
        /// @dev Streak as of `lastDay`. Use `currentStreak()` for the live value.
        uint32 streak;
        /// @dev Longest streak the member has ever reached.
        uint32 longestStreak;
        /// @dev All-time number of check-ins.
        uint32 totalCheckIns;
    }

    mapping(address member => Member) private _members;

    /// @notice All-time number of check-ins across every member.
    uint64 public totalCheckIns;

    /// @notice Number of addresses that have checked in at least once.
    uint32 public totalMembers;

    /// @param member  The address that checked in.
    /// @param day     UTC day index (unix timestamp / 86400) of the check-in.
    /// @param streak  The member's streak length including this check-in.
    /// @param total   The member's all-time check-in count including this one.
    /// @param note    Free-form public note, possibly empty.
    event CheckedIn(address indexed member, uint32 indexed day, uint32 streak, uint32 total, string note);

    error AlreadyCheckedInToday(uint32 day);
    error NoteTooLong(uint256 length, uint256 max);

    /// @notice Check in for today without a note.
    function checkIn() external {
        _checkIn("");
    }

    /// @notice Check in for today with a short public note.
    /// @param note Free-form text, at most `MAX_NOTE_BYTES` bytes. Pass "" for none.
    function checkIn(string calldata note) external {
        _checkIn(note);
    }

    /// @notice The current UTC day index.
    function today() public view returns (uint32) {
        return uint32(block.timestamp / SECONDS_PER_DAY);
    }

    /// @notice Raw stored record for `member`. All-zero if they never checked in.
    function memberOf(address member) external view returns (Member memory) {
        return _members[member];
    }

    /// @notice The member's streak right now, accounting for missed days.
    /// @dev The stored `streak` is only accurate as of `lastDay`: a member who last
    ///      checked in three days ago still has a stored streak, but their live streak
    ///      is 0. A streak survives until the end of the day after `lastDay`.
    function currentStreak(address member) public view returns (uint32) {
        Member storage m = _members[member];
        if (m.totalCheckIns == 0) return 0;
        uint32 t = today();
        return (t == m.lastDay || t == m.lastDay + 1) ? m.streak : 0;
    }

    /// @notice Whether `member` has already checked in during the current UTC day.
    function hasCheckedInToday(address member) external view returns (bool) {
        Member storage m = _members[member];
        return m.totalCheckIns != 0 && m.lastDay == today();
    }

    function _checkIn(string memory note) private {
        uint256 length = bytes(note).length;
        if (length > MAX_NOTE_BYTES) revert NoteTooLong(length, MAX_NOTE_BYTES);

        uint32 day = today();
        Member memory m = _members[msg.sender];

        if (m.totalCheckIns == 0) {
            m.firstDay = day;
            m.streak = 1;
            unchecked {
                ++totalMembers;
            }
        } else {
            if (m.lastDay == day) revert AlreadyCheckedInToday(day);
            // Consecutive days extend the streak; any gap starts a new one.
            m.streak = m.lastDay + 1 == day ? m.streak + 1 : 1;
        }

        m.lastDay = day;
        unchecked {
            ++m.totalCheckIns;
            ++totalCheckIns;
        }
        if (m.streak > m.longestStreak) m.longestStreak = m.streak;

        _members[msg.sender] = m;

        emit CheckedIn(msg.sender, day, m.streak, m.totalCheckIns, note);
    }
}

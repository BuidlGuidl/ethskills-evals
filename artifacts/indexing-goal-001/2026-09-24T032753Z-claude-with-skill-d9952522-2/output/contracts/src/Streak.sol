// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Streak
/// @notice Daily onchain check-in for a community. One check-in per member per UTC
///         day, with an optional short public note.
/// @dev Event-first by design: `CheckedIn` carries everything the read side needs
///      (who, when, note, and the member's streak/total *as of* that check-in), so
///      the indexer never has to re-derive state or call back into the contract.
contract Streak {
    /// @notice Length of a check-in day, in seconds. Days are UTC-aligned.
    uint256 public constant DAY = 86_400;

    /// @notice Maximum note length in bytes. Keeps calldata and log size bounded.
    uint256 public constant MAX_NOTE_BYTES = 140;

    /// @notice The UTC day index of the contract's first possible check-in.
    /// @dev Recorded at deploy so an indexer/UI can label day indices without
    ///      guessing, and so tests can reason about the epoch.
    uint32 public immutable deployDay;

    struct Member {
        /// UTC day index of the member's most recent check-in. 0 = never.
        uint32 lastDay;
        /// Consecutive-day streak as of `lastDay`.
        uint32 streak;
        /// All-time number of check-ins.
        uint32 total;
    }

    /// @notice Per-member check-in state. Packs into a single storage slot.
    mapping(address => Member) public members;

    /// @notice Total check-ins ever recorded, across all members.
    uint64 public totalCheckIns;

    /// @notice Number of distinct addresses that have ever checked in.
    uint64 public totalMembers;

    /// @notice Emitted on every successful check-in. This is the only state change,
    ///         and it is the complete record the read side is built from.
    /// @param member      Who checked in.
    /// @param day         UTC day index (unix seconds / 86400) of the check-in.
    /// @param streak      The member's consecutive-day streak including this check-in.
    /// @param total       The member's all-time check-in count including this one.
    /// @param isNewMember True if this was the member's first ever check-in.
    /// @param note        Optional public note, may be empty.
    event CheckedIn(
        address indexed member,
        uint32 indexed day,
        uint32 streak,
        uint32 total,
        bool isNewMember,
        string note
    );

    error AlreadyCheckedInToday(uint32 day);
    error NoteTooLong(uint256 length);

    constructor() {
        deployDay = uint32(block.timestamp / DAY);
    }

    /// @notice Check in for today with no note.
    function checkIn() external {
        _checkIn("");
    }

    /// @notice Check in for today with a short public note.
    /// @param note Free-form text, at most `MAX_NOTE_BYTES` bytes.
    function checkIn(string calldata note) external {
        if (bytes(note).length > MAX_NOTE_BYTES) revert NoteTooLong(bytes(note).length);
        _checkIn(note);
    }

    function _checkIn(string memory note) private {
        uint32 today = uint32(block.timestamp / DAY);
        Member memory m = members[msg.sender];

        if (m.lastDay == today) revert AlreadyCheckedInToday(today);

        bool isNewMember = m.total == 0;
        // A streak continues only if the previous check-in was literally yesterday.
        uint32 streak = (m.lastDay == today - 1) ? m.streak + 1 : 1;
        uint32 total = m.total + 1;

        members[msg.sender] = Member({lastDay: today, streak: streak, total: total});
        totalCheckIns += 1;
        if (isNewMember) totalMembers += 1;

        emit CheckedIn(msg.sender, today, streak, total, isNewMember, note);
    }

    /// @notice Current UTC day index.
    function currentDay() public view returns (uint32) {
        return uint32(block.timestamp / DAY);
    }

    /// @notice Whether `member` has already checked in for the current UTC day.
    function hasCheckedInToday(address member) external view returns (bool) {
        Member memory m = members[member];
        return m.total != 0 && m.lastDay == currentDay();
    }

    /// @notice A member's *live* streak, which is 0 once a day has been missed.
    /// @dev `members[x].streak` is the streak as of the last check-in and goes stale.
    ///      This applies the decay rule: the streak survives only while the member
    ///      checked in today or yesterday.
    function currentStreak(address member) external view returns (uint32) {
        Member memory m = members[member];
        if (m.total == 0) return 0;
        uint32 today = currentDay();
        if (m.lastDay == today || m.lastDay == today - 1) return m.streak;
        return 0;
    }
}

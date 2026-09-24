// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Streak
/// @notice Daily onchain check-in register for a community. One check-in per
///         member per UTC day, with an optional short public note.
/// @dev The contract is deliberately event-first: `CheckedIn` carries everything
///      the app needs (who, when, the note, and the member's totals *after* the
///      check-in), so an indexer never has to re-derive streak arithmetic and can
///      never disagree with the chain. Storage keeps only the single packed slot
///      needed to enforce the one-per-day rule and to compute the next streak.
contract Streak {
    /// @notice Length of a check-in day, in seconds. Days are UTC days, i.e.
    ///         `day = block.timestamp / 1 days`, counted from the Unix epoch.
    uint256 public constant DAY = 1 days;

    /// @notice Maximum length of a note, in bytes.
    uint256 public constant MAX_NOTE_BYTES = 140;

    /// @dev One storage slot per member (4 x uint32 = 128 bits).
    struct Record {
        uint32 lastDay; // UTC day index of the member's most recent check-in
        uint32 currentStreak; // consecutive days ending at `lastDay`
        uint32 longestStreak; // best streak ever reached
        uint32 total; // all-time check-ins
    }

    mapping(address => Record) private _records;

    /// @notice All-time check-ins across every member.
    uint256 public totalCheckIns;

    /// @notice Number of distinct addresses that have ever checked in.
    uint256 public totalMembers;

    /// @notice Emitted on every check-in. This is the app's read API.
    /// @param member      Who checked in.
    /// @param day         UTC day index (Unix day number) of the check-in.
    /// @param timestamp   Block timestamp of the check-in.
    /// @param streak      The member's streak *after* this check-in.
    /// @param total       The member's all-time check-ins *after* this check-in.
    /// @param note        Optional public note, may be empty.
    event CheckedIn(
        address indexed member,
        uint32 indexed day,
        uint64 timestamp,
        uint32 streak,
        uint32 total,
        string note
    );

    error AlreadyCheckedInToday(uint32 day);
    error NoteTooLong(uint256 length);

    /// @notice Check in for the current UTC day with an optional note.
    /// @param note Public note, up to {MAX_NOTE_BYTES} bytes. Pass "" for none.
    function checkIn(string calldata note) external {
        if (bytes(note).length > MAX_NOTE_BYTES) {
            revert NoteTooLong(bytes(note).length);
        }

        uint32 dayNow = uint32(block.timestamp / DAY);
        Record memory r = _records[msg.sender];

        if (r.total == 0) {
            totalMembers += 1;
            r.currentStreak = 1;
        } else {
            if (r.lastDay >= dayNow) revert AlreadyCheckedInToday(dayNow);
            r.currentStreak = r.lastDay == dayNow - 1 ? r.currentStreak + 1 : 1;
        }

        r.lastDay = dayNow;
        r.total += 1;
        if (r.currentStreak > r.longestStreak) r.longestStreak = r.currentStreak;

        _records[msg.sender] = r;
        totalCheckIns += 1;

        emit CheckedIn(msg.sender, dayNow, uint64(block.timestamp), r.currentStreak, r.total, note);
    }

    /// @notice The current UTC day index.
    function today() external view returns (uint32) {
        return uint32(block.timestamp / DAY);
    }

    /// @notice Whether `member` has already checked in for the current UTC day.
    function hasCheckedInToday(address member) external view returns (bool) {
        Record memory r = _records[member];
        return r.total != 0 && r.lastDay == uint32(block.timestamp / DAY);
    }

    /// @notice A member's stored record.
    /// @return lastDay       UTC day of their most recent check-in (0 if none).
    /// @return currentStreak Streak as of `lastDay`. See {liveStreak} for the
    ///                       value to show in a UI today.
    /// @return longestStreak Best streak ever reached.
    /// @return total         All-time check-ins.
    function recordOf(address member)
        external
        view
        returns (uint32 lastDay, uint32 currentStreak, uint32 longestStreak, uint32 total)
    {
        Record memory r = _records[member];
        return (r.lastDay, r.currentStreak, r.longestStreak, r.total);
    }

    /// @notice The streak a UI should display right now: the stored streak stays
    ///         alive while the member can still check in today, and is 0 once a
    ///         whole day has been missed.
    function liveStreak(address member) external view returns (uint32) {
        Record memory r = _records[member];
        if (r.total == 0) return 0;
        uint32 t = uint32(block.timestamp / DAY);
        return (r.lastDay == t || r.lastDay == t - 1) ? r.currentStreak : 0;
    }
}

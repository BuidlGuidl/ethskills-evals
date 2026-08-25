// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Streak
/// @notice Daily onchain check-in for a community. One check-in per member per UTC
///         day, with an optional short public note.
/// @dev Every state change emits `CheckedIn`, which carries everything the read side
///      needs (who, when, note, and the resulting streak/total). The contract keeps
///      no arrays and no rankings: the global feed and the monthly leaderboard are
///      built offchain by an indexer over the full `CheckedIn` history. What the
///      contract does keep is the per-member "as of now" state, because that is both
///      required to enforce one-check-in-per-day and cheap to co-locate in a single
///      storage slot -- so a profile screen can read a member's streak and total with
///      a plain view call instead of an indexed query.
contract Streak {
    /// @notice Longest note accepted, in bytes.
    uint256 public constant MAX_NOTE_BYTES = 140;

    /// @dev Packed into one 32-byte slot, so a check-in is a single SSTORE.
    struct Member {
        /// @dev UTC day index (unix timestamp / 1 days) of the last check-in.
        uint32 lastDay;
        /// @dev Consecutive-day count as of `lastDay`. Stale once a day is missed;
        ///      read `currentStreak` for the live value.
        uint32 streakAtLastDay;
        /// @dev All-time number of check-ins.
        uint32 totalCheckIns;
    }

    /// @notice Raw per-member state. Prefer `getMember` / `currentStreak`.
    mapping(address => Member) public members;

    /// @notice Number of distinct addresses that have ever checked in.
    uint32 public memberCount;

    /// @notice All-time number of check-ins across everyone.
    uint64 public totalCheckIns;

    /// @notice Emitted on every check-in. This is the complete record of the app.
    /// @param member Who checked in.
    /// @param day UTC day index (unix timestamp / 1 days) of the check-in.
    /// @param streak The member's consecutive-day streak including this check-in.
    /// @param memberTotal The member's all-time check-in count including this one.
    /// @param note Optional public note, up to `MAX_NOTE_BYTES` bytes. May be empty.
    event CheckedIn(
        address indexed member,
        uint32 indexed day,
        uint32 streak,
        uint32 memberTotal,
        string note
    );

    error AlreadyCheckedInToday(uint32 day);
    error NoteTooLong(uint256 length);

    /// @notice Check in for today, with an optional note. Reverts if the caller has
    ///         already checked in during the current UTC day.
    function checkIn(string calldata note) external {
        if (bytes(note).length > MAX_NOTE_BYTES) {
            revert NoteTooLong(bytes(note).length);
        }

        uint32 day = today();
        Member memory m = members[msg.sender];

        if (m.totalCheckIns != 0 && m.lastDay >= day) {
            revert AlreadyCheckedInToday(day);
        }

        uint32 streak = (m.totalCheckIns != 0 && m.lastDay + 1 == day)
            ? m.streakAtLastDay + 1
            : 1;

        if (m.totalCheckIns == 0) {
            memberCount += 1;
        }

        uint32 memberTotal = m.totalCheckIns + 1;
        members[msg.sender] = Member({
            lastDay: day,
            streakAtLastDay: streak,
            totalCheckIns: memberTotal
        });
        totalCheckIns += 1;

        emit CheckedIn(msg.sender, day, streak, memberTotal, note);
    }

    /// @notice The current UTC day index.
    function today() public view returns (uint32) {
        return uint32(block.timestamp / 1 days);
    }

    /// @notice Whether `member` can check in right now.
    function canCheckIn(address member) external view returns (bool) {
        Member memory m = members[member];
        return m.totalCheckIns == 0 || m.lastDay < today();
    }

    /// @notice A member's live streak: the stored streak if it is still alive (they
    ///         checked in today or yesterday), otherwise 0.
    function currentStreak(address member) public view returns (uint32) {
        Member memory m = members[member];
        if (m.totalCheckIns == 0) return 0;
        uint32 day = today();
        if (m.lastDay == day || m.lastDay + 1 == day) return m.streakAtLastDay;
        return 0;
    }

    /// @notice Everything the profile screen needs, in one call. Batch this across
    ///         members with Multicall3 rather than indexing it.
    function getMember(address member)
        external
        view
        returns (uint32 streak, uint32 total, uint32 lastDay)
    {
        Member memory m = members[member];
        return (currentStreak(member), m.totalCheckIns, m.lastDay);
    }
}

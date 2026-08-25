// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Streak
/// @notice Daily onchain check-in for a community. A member may check in once per
///         UTC day, optionally attaching a short public note.
/// @dev The contract is deliberately write-only from the app's point of view: every
///      check-in emits a `CheckedIn` event carrying the full state of that check-in
///      (author, day, note, resulting streak and total). The feed, profiles and
///      leaderboard are all derived offchain by indexing that event from the
///      contract's deployment block onwards — see ../../indexer.
///
///      The onchain mappings exist because the once-per-day rule and the streak
///      arithmetic need them anyway; they are a convenience for wallets/contracts
///      reading a single member, not the read path for the app (they cannot answer
///      "newest 50 check-ins across everyone" or "top members this month").
contract Streak {
    /// @notice Length of a check-in day, in seconds. Days are UTC-aligned:
    ///         day N covers [N * 1 days, (N + 1) * 1 days) in unix time.
    uint256 public constant DAY = 1 days;

    /// @notice Maximum length, in bytes, of the optional note.
    uint256 public constant MAX_NOTE_BYTES = 140;

    struct Member {
        /// @dev UTC day index of the member's most recent check-in. 0 = never.
        uint64 lastDay;
        /// @dev Consecutive-day streak as of `lastDay`. See `currentStreak`.
        uint32 streak;
        /// @dev Longest streak the member has ever reached.
        uint32 longestStreak;
        /// @dev All-time number of check-ins.
        uint64 total;
    }

    /// @notice Per-member check-in state.
    mapping(address => Member) public members;

    /// @notice Total number of check-ins ever recorded, across all members.
    uint256 public totalCheckIns;

    /// @notice Number of distinct addresses that have ever checked in.
    uint256 public totalMembers;

    /// @notice Emitted on every successful check-in.
    /// @param member       The address that checked in.
    /// @param day          UTC day index of the check-in (unix timestamp / 1 days).
    /// @param timestamp    Block timestamp of the check-in.
    /// @param streak       The member's consecutive-day streak including this check-in.
    /// @param total        The member's all-time check-in count including this one.
    /// @param note         Optional public note; may be empty.
    event CheckedIn(
        address indexed member, uint64 indexed day, uint64 timestamp, uint32 streak, uint64 total, string note
    );

    /// @notice Emitted the first time an address checks in.
    event MemberJoined(address indexed member, uint64 indexed day, uint64 timestamp);

    error AlreadyCheckedInToday(uint64 day);
    error NoteTooLong(uint256 length, uint256 max);

    /// @notice Check in for the current UTC day with an optional public note.
    /// @param note Free-form note, up to `MAX_NOTE_BYTES` bytes. Pass "" for none.
    function checkIn(string calldata note) external {
        if (bytes(note).length > MAX_NOTE_BYTES) {
            revert NoteTooLong(bytes(note).length, MAX_NOTE_BYTES);
        }

        // casting to 'uint64' is safe because a uint64 day index covers ~5e14 years
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 day = uint64(block.timestamp / DAY);
        Member storage m = members[msg.sender];

        // `lastDay == 0` means "never checked in": the contract cannot be deployed
        // at unix day 0, so 0 is unambiguous.
        if (m.lastDay == 0) {
            unchecked {
                ++totalMembers;
            }
            // forge-lint: disable-next-line(unsafe-typecast)
            emit MemberJoined(msg.sender, day, uint64(block.timestamp));
        } else if (m.lastDay == day) {
            revert AlreadyCheckedInToday(day);
        }

        // Consecutive if the previous check-in was yesterday, otherwise the streak
        // restarts at 1.
        uint32 newStreak = m.lastDay == day - 1 ? m.streak + 1 : 1;

        m.lastDay = day;
        m.streak = newStreak;
        if (newStreak > m.longestStreak) {
            m.longestStreak = newStreak;
        }
        unchecked {
            m.total += 1;
            ++totalCheckIns;
        }

        // forge-lint: disable-next-line(unsafe-typecast)
        emit CheckedIn(msg.sender, day, uint64(block.timestamp), newStreak, m.total, note);
    }

    /// @notice The UTC day index for the current block.
    function today() public view returns (uint64) {
        // casting to 'uint64' is safe because a uint64 day index covers ~5e14 years
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint64(block.timestamp / DAY);
    }

    /// @notice Whether `member` can still check in during the current UTC day.
    function canCheckIn(address member) external view returns (bool) {
        return members[member].lastDay != today();
    }

    /// @notice A member's streak *as of now*, i.e. 0 once a day has been missed.
    /// @dev `members[member].streak` is the streak as of their last check-in and
    ///      does not decay on its own; this view applies the decay. The indexer
    ///      applies the same rule when serving profiles.
    function currentStreak(address member) external view returns (uint32) {
        Member storage m = members[member];
        uint64 t = today();
        if (m.lastDay == t || m.lastDay == t - 1) {
            return m.streak;
        }
        return 0;
    }
}

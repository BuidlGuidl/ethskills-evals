// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title StreakCheckIn
/// @notice One public daily check-in per address for a community on Base.
contract StreakCheckIn {
    error AlreadyCheckedIn(uint256 day);
    error NoteTooLong(uint256 length, uint256 maxLength);

    uint256 public constant MAX_NOTE_BYTES = 160;

    mapping(address member => uint256 day) public lastCheckInDay;
    mapping(address member => uint256 totalCheckIns) public totalCheckIns;

    event CheckedIn(
        address indexed member,
        uint256 indexed day,
        uint256 timestamp,
        string note
    );

    /// @notice Check in once for the current UTC day.
    /// @dev The read side builds feed, streak, and leaderboard projections from this event.
    function checkIn(string calldata note) external {
        bytes calldata noteBytes = bytes(note);
        if (noteBytes.length > MAX_NOTE_BYTES) {
            revert NoteTooLong(noteBytes.length, MAX_NOTE_BYTES);
        }

        uint256 day = block.timestamp / 1 days;
        if (lastCheckInDay[msg.sender] == day) {
            revert AlreadyCheckedIn(day);
        }

        lastCheckInDay[msg.sender] = day;
        unchecked {
            totalCheckIns[msg.sender] += 1;
        }

        emit CheckedIn(msg.sender, day, block.timestamp, note);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Streak
/// @notice Daily onchain check-ins for a community.
contract Streak {
    uint256 public constant MAX_NOTE_BYTES = 160;
    uint256 public constant SECONDS_PER_DAY = 1 days;

    uint256 public nextCheckInId = 1;
    uint256 public globalCheckIns;

    mapping(address member => uint256 day) public lastCheckInDay;
    mapping(address member => uint256 total) public totalCheckIns;
    mapping(address member => uint256 streak) public currentStreak;

    event CheckIn(
        uint256 indexed checkInId,
        address indexed member,
        uint256 indexed day,
        string note,
        uint256 streak,
        uint256 totalCheckIns
    );

    error AlreadyCheckedIn(uint256 day);
    error NoteTooLong(uint256 length, uint256 maxLength);

    /// @notice Check in once for the current UTC day.
    /// @dev Day boundaries are Unix UTC days: block.timestamp / 1 days.
    function checkIn(string calldata note) external {
        uint256 noteLength = bytes(note).length;
        if (noteLength > MAX_NOTE_BYTES) {
            revert NoteTooLong(noteLength, MAX_NOTE_BYTES);
        }

        uint256 day = block.timestamp / SECONDS_PER_DAY;
        if (lastCheckInDay[msg.sender] == day) {
            revert AlreadyCheckedIn(day);
        }

        uint256 previousDay = lastCheckInDay[msg.sender];
        uint256 newStreak = previousDay != 0 && previousDay + 1 == day
            ? currentStreak[msg.sender] + 1
            : 1;
        uint256 newTotal = totalCheckIns[msg.sender] + 1;
        uint256 checkInId = nextCheckInId;

        lastCheckInDay[msg.sender] = day;
        currentStreak[msg.sender] = newStreak;
        totalCheckIns[msg.sender] = newTotal;
        globalCheckIns += 1;
        nextCheckInId = checkInId + 1;

        emit CheckIn(checkInId, msg.sender, day, note, newStreak, newTotal);
    }
}

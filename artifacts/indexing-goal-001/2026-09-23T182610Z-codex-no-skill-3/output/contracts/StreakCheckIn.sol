// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title StreakCheckIn
/// @notice A minimal daily onchain check-in contract for a community.
contract StreakCheckIn {
    uint256 public constant MAX_NOTE_BYTES = 160;

    mapping(address member => uint256 day) public lastCheckInDay;
    mapping(address member => uint256 count) public totalCheckIns;

    event CheckIn(address indexed member, uint256 indexed day, string note);

    error AlreadyCheckedIn(address member, uint256 day);
    error NoteTooLong(uint256 length, uint256 maxLength);

    /// @notice Check in once for the current UTC day.
    /// @param note Optional public note emitted in the CheckIn event.
    function checkIn(string calldata note) external {
        uint256 noteLength = bytes(note).length;
        if (noteLength > MAX_NOTE_BYTES) {
            revert NoteTooLong(noteLength, MAX_NOTE_BYTES);
        }

        uint256 day = block.timestamp / 1 days;
        if (lastCheckInDay[msg.sender] == day) {
            revert AlreadyCheckedIn(msg.sender, day);
        }

        lastCheckInDay[msg.sender] = day;
        totalCheckIns[msg.sender] += 1;

        emit CheckIn(msg.sender, day, note);
    }
}
